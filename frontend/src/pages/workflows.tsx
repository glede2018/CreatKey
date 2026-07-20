import { useEffect, useState } from "react";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Workflow } from "@/types";

/** 工作流列表页面。 */
export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    api<Workflow[]>("/workflows")
      .then((items) => active && setWorkflows(items))
      .catch(() => toast.error("工作流列表加载失败"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function createWorkflow() {
    if (creating) return;
    const editorWindow = window.open("about:blank", "_blank");
    if (!editorWindow) {
      toast.error("新窗口被浏览器拦截，请允许弹出窗口后重试");
      return;
    }
    editorWindow.opener = null;
    setCreating(true);
    try {
      const workflow = await api<Workflow>("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: "未命名",
          definition: {
            schemaVersion: 1,
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        }),
      });
      setWorkflows((items) => [workflow, ...items]);
      editorWindow.location.replace(
        `/?workflow=${encodeURIComponent(workflow.id)}`,
      );
    } catch (error) {
      editorWindow.close();
      toast.error(error instanceof Error ? error.message : "工作流创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-8 pt-2" aria-label="工作流页面">
      {loading ? (
        <div className="ck-loading grid h-56 place-items-center">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          <button
            type="button"
            disabled={creating}
            aria-busy={creating}
            onClick={createWorkflow}
            className="ck-workflow-new group flex aspect-[1.62/1] min-h-40 flex-col items-center justify-center rounded-[10px] transition disabled:cursor-wait disabled:opacity-70"
          >
            {creating ? (
              <Loader2 size={25} className="ck-text-secondary mb-3 animate-spin" />
            ) : (
              <Plus
                size={25}
                strokeWidth={1.4}
                className="ck-text-secondary mb-3 transition group-hover:scale-110"
              />
            )}
            {creating ? "正在创建…" : "新建工作流"}
          </button>
          {workflows.map((item, index) => (
            <a
              key={item.id}
              href={`/?workflow=${encodeURIComponent(item.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ck-workflow-card group overflow-hidden rounded-[10px] text-left transition"
            >
              <div className="ck-workflow-cover-frame relative aspect-[2.05/1] overflow-hidden">
                <div
                  className={`workflow-cover workflow-cover-${index % 3} absolute inset-2 rounded-md`}
                />
                <span className="ck-workflow-open absolute right-2 top-2 rounded-md px-2 py-1 opacity-0 backdrop-blur group-hover:opacity-100">
                  打开
                </span>
              </div>
              <div className="flex items-start justify-between p-3">
                <div className="min-w-0">
                  <p className="ck-workflow-title truncate">{item.name || "未命名"}</p>
                  <p className="ck-workflow-date mt-1">
                    {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
                <MoreHorizontal size={17} className="ck-workflow-more" />
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
