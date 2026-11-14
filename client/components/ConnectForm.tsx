'use client';

import { Radio } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useStrings } from '../lib/i18n';

type Props = {
  busy: boolean;
  error?: string | null;
  onConnect: (liveId: string) => void;
};

export function ConnectForm({ busy, error, onConnect }: Props) {
  const t = useStrings();
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
        <h1>{t.connectTitle}</h1>
        <p>{t.connectHint}</p>
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
          {busy ? t.connecting : t.connect}
        </button>
      </form>
    </div>
  );
}
