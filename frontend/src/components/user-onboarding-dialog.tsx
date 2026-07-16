import { useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles, Store, Upload, UserRound, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Role, User } from "@/types";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface UserOnboardingDialogProps {
  user?: User;
  open: boolean;
  onComplete: (user: User) => void;
}

/** 首次登录后强制补全用户资料，完成前不可关闭或操作工作台。 */
export function UserOnboardingDialog({ user, open, onComplete }: UserOnboardingDialogProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<Role>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setNickname(user.nickname.startsWith("用户") ? "" : user.nickname);
    setRole(user.roles[0]);
    setAvatarUrl(user.avatarUrl);
    setError("");
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function selectAvatar(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("头像仅支持 PNG、JPG 或 WebP 图片");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("头像大小不能超过 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result));
      setError("");
    };
    reader.onerror = () => setError("头像读取失败，请重新选择");
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!role || !avatarUrl || nickname.trim().length < 2) return;
    setSaving(true);
    setError("");
    try {
      onComplete(
        await api<User>("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify({ nickname: nickname.trim(), role, avatarUrl: avatarUrl ?? null }),
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "用户设置保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !user) return null;
  return (
    <div className="ck-onboarding-backdrop fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4 sm:p-8">
      <section
        className="ck-onboarding-card my-auto w-full max-w-[680px] overflow-hidden rounded-2xl border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <header className="ck-onboarding-header border-b px-6 py-6 sm:px-8">
          <span className="ck-onboarding-mark mb-5 grid size-10 place-items-center rounded-xl">
            <Sparkles size={18} />
          </span>
          <p className="ck-onboarding-step">WELCOME TO CREATKEY</p>
          <h1 id="onboarding-title" className="mt-2 text-2xl font-medium tracking-tight">
            设置你的创作身份
          </h1>
          <p className="ck-onboarding-copy mt-2 text-sm">完善基础资料后，即可开始使用工作台。</p>
        </header>

        <div className="space-y-7 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="ck-avatar-upload group relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border"
              aria-label="上传头像"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="头像预览" className="size-full object-cover" />
              ) : (
                <ImagePlus size={25} />
              )}
              <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center gap-1 opacity-0 transition group-hover:opacity-100">
                <Upload size={11} /> 更换
              </span>
            </button>
            <div>
              <h2 className="text-sm font-medium">
                上传头像 <span className="ck-required">*</span>
              </h2>
              <p className="ck-onboarding-help mt-1 text-xs leading-5">
                必填，支持 PNG、JPG、WebP，文件不超过 2MB。
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                onClick={() => uploadRef.current?.click()}
              >
                <Upload size={13} /> 选择图片
              </Button>
              <input
                ref={uploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => selectAvatar(event.target.files?.[0])}
              />
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              用户名 <span className="ck-required">*</span>
            </span>
            <div className="relative">
              <UserRound className="ck-onboarding-input-icon absolute left-3 top-3" size={16} />
              <Input
                value={nickname}
                maxLength={20}
                autoFocus
                className="h-11 pl-10"
                placeholder="输入 2-20 个字符"
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              选择角色 <span className="ck-required">*</span>
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    value: "CREATOR",
                    title: "制作人",
                    copy: "使用模型与工作流完成内容创作",
                    icon: WandSparkles,
                  },
                  {
                    value: "MERCHANT",
                    title: "商家",
                    copy: "管理商业素材并规模化生产内容",
                    icon: Store,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRole(item.value)}
                  className={`ck-role-option rounded-xl border p-4 text-left transition ${role === item.value ? "is-active" : ""}`}
                >
                  <span className="flex items-start gap-3">
                    <span className="ck-role-icon grid size-9 shrink-0 place-items-center rounded-lg">
                      <item.icon size={17} />
                    </span>
                    <span>
                      <b className="block text-sm font-medium">{item.title}</b>
                      <small className="ck-onboarding-help mt-1 block text-xs leading-5">
                        {item.copy}
                      </small>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className="login-error rounded-lg border px-3 py-2">{error}</p>}
          <Button
            className="h-11 w-full"
            disabled={saving || !role || !avatarUrl || nickname.trim().length < 2}
            onClick={submit}
          >
            {saving ? "正在保存…" : "完成设置，进入工作台"}
          </Button>
        </div>
      </section>
    </div>
  );
}
