interface PromptEditorProps {
  value: string;
  field: "prompt" | "text";
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PromptEditor({ value, field, onChange, disabled = false }: PromptEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      disabled={disabled}
      placeholder={field === "prompt" ? "输入提示词，或从文本端口连接" : "输入文本"}
      className="nodrag nowheel min-h-20 w-full resize-none bg-transparent text-[10px] outline-none disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}
