#!/usr/bin/env python3
"""Publish the track OBS is playing to the YTChatHub data directory.

OBS's VLC source keeps the file it is playing open, so the current track is read from
OBS's open file descriptors (/proc/<pid>/fd). Its tags and embedded cover are read with
ffprobe and ffmpeg. This has to run on the host: a container cannot read another
process's descriptors.

Usage: now-playing.py MUSIC_DIR [DATA_DIR]

Writes DATA_DIR/now-playing.json and DATA_DIR/now-playing-cover.jpg. The JSON file is
touched every few seconds as a heartbeat; the backend treats an untouched file as nothing
playing, so a stopped watcher never leaves a stale song on screen.
"""

import json
import os
import subprocess
import sys
import time

POLL_S = 1.0
HEARTBEAT_S = 5.0
# VLC closes one file before it opens the next; a gap shorter than this is a track change, not a stop.
STOP_GRACE_S = 4.0
# During a change both files can be open for a moment; a new file has to stay open this long to take over.
SETTLE_S = 1.5
COVER_PX = 512
AUDIO = ('.mp3', '.flac', '.m4a', '.ogg', '.opus', '.wav', '.aac')


def obs_pids():
    for pid in os.listdir('/proc'):
        if not pid.isdigit():
            continue
        try:
            with open(f'/proc/{pid}/comm') as f:
                if f.read().strip() == 'obs':
                    yield pid
        except OSError:
            pass


def open_tracks(music_dir):
    prefix = music_dir.rstrip('/') + '/'
    found = []
    for pid in obs_pids():
        try:
            fds = os.listdir(f'/proc/{pid}/fd')
        except OSError:
            continue
        for fd in fds:
            try:
                target = os.readlink(f'/proc/{pid}/fd/{fd}')
            except OSError:
                continue
            if target.startswith(prefix) and target.lower().endswith(AUDIO) and target not in found:
                found.append(target)
    return found


def tags(track):
    # MP3 and M4A keep tags on the container, Ogg and Opus on the audio stream.
    found = {}
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-protocol_whitelist', 'file',
             '-show_entries', 'format_tags=title,artist:stream_tags=title,artist', '-of', 'json', track],
            capture_output=True, timeout=5, check=True,
        ).stdout
        probed = json.loads(out)
        for source in [s.get('tags', {}) for s in probed.get('streams', [])] + [probed.get('format', {}).get('tags', {})]:
            found.update({k.lower(): v for k, v in source.items() if isinstance(v, str) and v.strip()})
    except (OSError, subprocess.SubprocessError, ValueError, AttributeError):
        pass
    title = found.get('title', '').strip() or os.path.splitext(os.path.basename(track))[0]
    return title, found.get('artist', '').strip()


def write_cover(track, path):
    tmp = path + '.tmp.jpg'
    try:
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-threads', '2', '-protocol_whitelist', 'file', '-i', track, '-an', '-map', '0:v:0', '-frames:v', '1',
             '-vf', f'scale={COVER_PX}:{COVER_PX}:force_original_aspect_ratio=increase,crop={COVER_PX}:{COVER_PX}',
             '-q:v', '3', tmp],
            capture_output=True, timeout=5, check=True,
        )
        os.replace(tmp, path)
        return True
    except (OSError, subprocess.SubprocessError):
        try:
            os.remove(tmp)
        except OSError:
            pass
        return False


def write_json(path, data):
    tmp = path + '.tmp'
    try:
        with open(tmp, 'w') as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, path)
    except OSError as error:
        print(f'cannot write {path}: {error}', file=sys.stderr, flush=True)


def touch(path):
    try:
        os.utime(path)
        return True
    except OSError:
        return False


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    music_dir = os.path.realpath(os.path.expanduser(sys.argv[1]))
    here = os.path.dirname(os.path.realpath(__file__))
    data_dir = os.path.realpath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'data'))
    os.makedirs(data_dir, exist_ok=True)
    state_file = os.path.join(data_dir, 'now-playing.json')
    cover_file = os.path.join(data_dir, 'now-playing-cover.jpg')

    last = ''
    current = None
    beat = 0.0
    gone_since = None
    pending, pending_since = None, 0.0
    while True:
        now = time.monotonic()
        tracks = open_tracks(music_dir)
        if last and last in tracks:
            # The playing file is still open: anything else is VLC reaching for the next item.
            track, gone_since, pending = last, None, None
        elif tracks:
            gone_since = None
            if pending not in tracks:
                pending, pending_since = tracks[0], now
            track = pending if now - pending_since >= SETTLE_S else last
        else:
            pending = None
            gone_since = gone_since or now
            track = last if last and now - gone_since < STOP_GRACE_S else None
        if track != last:
            last = track
            if track:
                # Keep the old entry alive while the new track's tags and cover are read.
                touch(state_file)
                title, artist = tags(track)
                cover = write_cover(track, cover_file)
                current = {'title': title, 'artist': artist, 'cover': cover, 'since': int(time.time() * 1000)}
                print(f'now playing: {artist} - {title}', flush=True)
            else:
                current = {'title': '', 'artist': '', 'cover': False, 'since': int(time.time() * 1000)}
                print('nothing playing', flush=True)
            write_json(state_file, current)
            beat = time.monotonic()
        elif current is not None and time.monotonic() - beat >= HEARTBEAT_S:
            # Before this run has written anything the file on disk is the previous run's, so it is left to go stale.
            # Rewrite the entry if something removed it.
            if not touch(state_file):
                write_json(state_file, current)
            beat = time.monotonic()
        time.sleep(POLL_S)


if __name__ == '__main__':
    main()
