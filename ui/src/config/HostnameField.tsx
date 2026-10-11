import type { Ref } from "preact";

export function HostnameField({
  id,
  value,
  onInput,
  inputRef,
}: {
  id: string;
  value: string;
  onInput: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="form-group">
      <label htmlFor={id}>Hostname</label>
      <input
        ref={inputRef}
        type="text"
        id={id}
        maxLength={31}
        pattern="[A-Za-z0-9]([A-Za-z0-9-]{0,29}[A-Za-z0-9])?"
        required
        value={value}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
      <p className="hint">Letters, digits, hyphen — no .local</p>
    </div>
  );
}
