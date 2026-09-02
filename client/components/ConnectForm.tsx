'use client';

import { Radio } from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Props = {
  busy: boolean;
  error?: string | null;
  onConnect: (liveId: string) => void;
};

export function ConnectForm({ busy, error, onConnect }: Props) {
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onConnect(value.trim());
  };

  return (
    <div className="connect">
      <form className="connect__card" onSubmit={submit}>
        <span className="connect__icon">
          <Radio size={22} />
        </span>
        <h1>Connect to a live stream</h1>
        <p>Paste the video URL or the 11 character video id of a stream that is live now.</p>
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          disabled={busy}
          spellCheck={false}
        />
        {error && <p className="connect__error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy || !value.trim()}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
