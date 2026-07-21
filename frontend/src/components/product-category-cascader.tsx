import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { ProductCategory } from "@/types";

interface ProductCategoryCascaderProps {
  categories: ProductCategory[];
  value: string;
  onChange: (leafId: string) => void;
  disabled?: boolean;
}

function findCategoryPath(categories: ProductCategory[], leafId: string) {
  for (const root of categories) {
    for (const branch of root.children) {
      const leaf = branch.children.find((item) => item.id === leafId);
      if (leaf) return { root, branch, leaf };
    }
  }
  return undefined;
}

function filterCategoryTree(categories: ProductCategory[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return categories;
  return categories.flatMap((root) => {
    if (root.name.toLocaleLowerCase().includes(keyword)) return [root];
    const children = root.children.flatMap((branch) => {
      if (branch.name.toLocaleLowerCase().includes(keyword)) return [branch];
      const leaves = branch.children.filter((leaf) =>
        leaf.name.toLocaleLowerCase().includes(keyword),
      );
      return leaves.length ? [{ ...branch, children: leaves }] : [];
    });
    return children.length ? [{ ...root, children }] : [];
  });
}

/** 单输入框外观、三列展开面板的商品分类单选组件。 */
export function ProductCategoryCascader({
  categories,
  value,
  onChange,
  disabled = false,
}: ProductCategoryCascaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rootId, setRootId] = useState("");
  const [branchId, setBranchId] = useState("");

  const selectedPath = useMemo(() => findCategoryPath(categories, value), [categories, value]);
  const filteredCategories = useMemo(
    () => filterCategoryTree(categories, search),
    [categories, search],
  );

  const activeRoot = filteredCategories.find((item) => item.id === rootId) ?? filteredCategories[0];
  const activeBranch =
    activeRoot?.children.find((item) => item.id === branchId) ?? activeRoot?.children[0];

  useEffect(() => {
    if (!selectedPath) return;
    setRootId(selectedPath.root.id);
    setBranchId(selectedPath.branch.id);
  }, [selectedPath]);

  useEffect(() => {
    if (!open) return;
    function closeWhenClickingOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeWhenClickingOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenClickingOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (open) return setOpen(false);
    setSearch("");
    if (selectedPath) {
      setRootId(selectedPath.root.id);
      setBranchId(selectedPath.branch.id);
    }
    setOpen(true);
  }

  const displayValue = selectedPath
    ? `${selectedPath.root.name} / ${selectedPath.branch.name} / ${selectedPath.leaf.name}`
    : "请选择商品分类";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={`ck-asset-form-control flex h-10 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm outline-none disabled:opacity-50 ${
          selectedPath ? "text-zinc-200" : "text-zinc-600"
        }`}
      >
        <span className="min-w-0 truncate">{displayValue}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[680px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#181818] shadow-2xl shadow-black/50">
          <div className="border-b border-white/[.07] p-3">
            <label className="relative block">
              <span className="sr-only">搜索商品分类</span>
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索分类"
                className="h-9 w-full rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-500/60"
              />
            </label>
          </div>

          {filteredCategories.length ? (
            <div className="grid grid-cols-3 divide-x divide-white/[.07]">
              <div className="max-h-72 overflow-y-auto p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-medium text-zinc-600">一级分类</p>
                {filteredCategories.map((root) => (
                  <button
                    key={root.id}
                    type="button"
                    onClick={() => {
                      setRootId(root.id);
                      setBranchId(root.children[0]?.id ?? "");
                    }}
                    className={`flex h-9 w-full items-center rounded-md px-2 text-left text-xs transition ${
                      activeRoot?.id === root.id
                        ? "bg-blue-500/10 text-blue-400"
                        : "text-zinc-400 hover:bg-white/[.05] hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">{root.name}</span>
                  </button>
                ))}
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-medium text-zinc-600">二级分类</p>
                {activeRoot?.children.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setBranchId(branch.id)}
                    className={`flex h-9 w-full items-center rounded-md px-2 text-left text-xs transition ${
                      activeBranch?.id === branch.id
                        ? "bg-blue-500/10 text-blue-400"
                        : "text-zinc-400 hover:bg-white/[.05] hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">{branch.name}</span>
                  </button>
                ))}
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-medium text-zinc-600">三级分类</p>
                <div role="listbox" aria-label="三级分类">
                  {activeBranch?.children.map((leaf) => {
                    const selected = leaf.id === value;
                    return (
                      <button
                        key={leaf.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => onChange(leaf.id)}
                        className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${
                          selected
                            ? "bg-blue-500/10 text-blue-400"
                            : "text-zinc-400 hover:bg-white/[.05] hover:text-zinc-200"
                        }`}
                      >
                        <span
                          className={`grid size-4 shrink-0 place-items-center rounded border ${
                            selected
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-white/15 bg-black/20"
                          }`}
                          aria-hidden="true"
                        >
                          {selected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{leaf.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid h-32 place-items-center text-xs text-zinc-600">
              没有找到相关分类
            </div>
          )}
        </div>
      )}
    </div>
  );
}
