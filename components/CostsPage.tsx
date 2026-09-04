"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileUp,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { buttonClass } from "@/components/Button";
import { CustomSelect } from "@/components/CustomSelect";
import {
  COST_VARIATION_THRESHOLDS,
  calculateBaseUnitCost,
  calculateEffectiveUnitCost,
  costService,
  effectiveUnitCostForItem,
  effectiveUnitForItem,
  getCostHealthMetrics,
  priceVariation,
  purchaseService,
  structureCostService,
  supplierService,
  teamCostService,
} from "@/services/costs.service";
import { money, parseBRL } from "@/lib/financial";
import { sanitizeDecimal } from "@/lib/input";
import { daysAgo, todayISO } from "@/lib/date";
import type {
  BasePurchaseUnit,
  CostItem,
  CostItemType,
  Purchase,
  PurchaseUnit,
  StructureCost,
  Supplier,
  TeamCost,
} from "@/types/cost";

type Tab = "items" | "purchases" | "structure" | "team";
type Filter =
  "all" | "ingredient" | "packaging" | "adjusted" | "impact" | "stale";
type Sort = "name" | "base" | "variation";
type Drawer =
  | { kind: "item"; item?: CostItem }
  | { kind: "details"; item: CostItem }
  | { kind: "affected"; item: CostItem }
  | { kind: "purchase"; item?: CostItem }
  | { kind: "structure" }
  | { kind: "team" }
  | { kind: "import" }
  | null;

const unitOptions: PurchaseUnit[] = ["kg", "g", "L", "ml", "un", "cx", "pct"];
const baseUnitOptions: BasePurchaseUnit[] = ["kg", "g", "L", "ml", "un"];
const categories = [
  "Carnes",
  "Laticínios",
  "Hortifruti",
  "Pães",
  "Bebidas",
  "Molhos",
  "Descartáveis",
  "Embalagens",
];
const structureCategories = [
  "Aluguel",
  "Energia",
  "Água",
  "Gás",
  "Internet",
  "Software",
  "Contabilidade",
  "Manutenção",
  "Limpeza",
  "Marketing",
  "Pró-labore",
  "Taxas bancárias",
  "Outros",
];
const dateBR = (value: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
const dateMobile = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
};
const decimal = (value: string) => sanitizeDecimal(value, 3);
const variationLabel = (value: number | null) =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
const productCountLabel = (count: number) =>
  `${count} ${count === 1 ? "produto" : "produtos"}`;
const productUsageLabel = (count: number) =>
  `${productCountLabel(count)} ${count === 1 ? "utiliza" : "utilizam"} este item`;

export function CostsPage({
  initialItems,
  initialPurchases,
  suppliers: initialSuppliers,
  initialStructure,
  initialTeam,
}: {
  initialItems: CostItem[];
  initialPurchases: Purchase[];
  suppliers: Supplier[];
  initialStructure: StructureCost[];
  initialTeam: TeamCost[];
}) {
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState(initialItems);
  const [purchaseRows, setPurchases] = useState(initialPurchases);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [structures, setStructures] = useState(initialStructure);
  const [team, setTeam] = useState(initialTeam);
  const [storageReady] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [ascending, setAscending] = useState(true);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [action, setAction] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAction(null);
    };
    window.addEventListener("keydown", closeMenus);
    return () => window.removeEventListener("keydown", closeMenus);
  }, []);
  useEffect(() => {
    if (storageReady) void purchaseService.replaceAll(purchaseRows);
  }, [purchaseRows, storageReady]);
  useEffect(() => {
    if (storageReady) void supplierService.replaceAll(suppliers);
  }, [suppliers, storageReady]);
  useEffect(() => {
    if (storageReady) void structureCostService.replaceAll(structures);
  }, [structures, storageReady]);
  useEffect(() => {
    if (storageReady) void teamCostService.replaceAll(team);
  }, [team, storageReady]);
  const supplierName = (id?: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? "Não informado";
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };
  const visible = useMemo(
    () =>
      items
        .filter((item) =>
          `${item.name} ${item.category} ${supplierName(item.supplierId)}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
        )
        .filter(
          (item) =>
            filter === "all" ||
            filter === item.type ||
            (filter === "adjusted" &&
              priceVariation(item.baseUnitCost, item.previousUnitCost) !== 0) ||
            (filter === "impact" &&
              priceVariation(item.baseUnitCost, item.previousUnitCost) !== 0 &&
              item.usedBy.length > 0) ||
            (filter === "stale" && item.history.length === 0),
        )
        .sort((a, b) => {
          const av =
            sort === "name"
              ? a.name
              : sort === "base"
                ? effectiveUnitCostForItem(a)
                : (priceVariation(
                    effectiveUnitCostForItem(a),
                    a.previousUnitCost,
                  ) ?? -999);
          const bv =
            sort === "name"
              ? b.name
              : sort === "base"
                ? effectiveUnitCostForItem(b)
                : (priceVariation(
                    effectiveUnitCostForItem(b),
                    b.previousUnitCost,
                  ) ?? -999);
          const result =
            typeof av === "string"
              ? av.localeCompare(String(bv), "pt-BR")
              : av - Number(bv);
          return ascending ? result : -result;
        }),
    [items, query, filter, sort, ascending],
  );
  const sortBy = (next: Sort) => {
    if (sort === next) setAscending((v) => !v);
    else {
      setSort(next);
      setAscending(true);
    }
  };
  const saveItem = async (item: CostItem) => {
    try {
      const saved = await costService.save(item);
      setItems((current) =>
        current.some((x) => x.id === saved.id)
          ? current.map((x) => (x.id === saved.id ? saved : x))
          : [...current, saved],
      );
      setDrawer(null);
      showToast(
        item.createdAt === item.updatedAt
          ? "Insumo cadastrado."
          : "Insumo atualizado.",
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o insumo.",
      );
    }
  };
  const remove = async (item: CostItem) => {
    if (item.usedBy.length) {
      setDrawer({ kind: "affected", item });
      return;
    }
    try {
      await costService.remove(item.id);
      setItems((current) => current.filter((x) => x.id !== item.id));
      setAction(null);
      showToast("Insumo excluído.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o insumo.",
      );
    }
  };
  return (
    <section className={`costs-page costs-page-container costs-page-${tab}`}>
      <header className="costs-heading">
        <div>
          <h1>Custos</h1>
          <p>Gerencie insumos, compras e custos que impactam seus preços.</p>
        </div>
        <div className="costs-heading-actions">
          {tab === "items" && (
            <>
              <button
                className={buttonClass("secondary")}
                onClick={() => setDrawer({ kind: "import" })}
              >
                <FileUp />
                Importar
              </button>
              <button
                className={buttonClass("primary")}
                onClick={() => setDrawer({ kind: "item" })}
              >
                <Plus />
                Novo insumo
              </button>
            </>
          )}
          {tab === "purchases" && (
            <button
              className={buttonClass("primary")}
              onClick={() => setDrawer({ kind: "purchase" })}
            >
              <Plus />
              Registrar compra
            </button>
          )}
          {tab === "structure" && (
            <button
              className={buttonClass("primary")}
              onClick={() => setDrawer({ kind: "structure" })}
            >
              <Plus />
              Novo custo
            </button>
          )}
          {tab === "team" && (
            <button
              className={buttonClass("primary")}
              onClick={() => setDrawer({ kind: "team" })}
            >
              <Plus />
              Novo custo de equipe
            </button>
          )}
        </div>
      </header>
      <nav className="product-tabs costs-tabs" aria-label="Áreas de custos">
        {(
          [
            ["items", "Insumos"],
            ["purchases", "Compras"],
            ["structure", "Estrutura"],
            ["team", "Equipe"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
            key={key}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "items" && (
        <ImprovedItemsTab
          items={visible}
          allItems={items}
          supplierName={supplierName}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          sortBy={sortBy}
          action={action}
          setAction={setAction}
          setDrawer={setDrawer}
          remove={remove}
        />
      )}
      {tab === "purchases" && (
        <ImprovedPurchasesTab
          rows={purchaseRows}
          items={items}
          suppliers={suppliers}
          notify={showToast}
          changed={setPurchases}
        />
      )}
      {tab === "structure" && (
        <ImprovedStructureTab
          rows={structures}
          openNew={() => setDrawer({ kind: "structure" })}
          notify={showToast}
          changed={setStructures}
        />
      )}
      {tab === "team" && (
        <ImprovedTeamTab
          rows={team}
          openNew={() => setDrawer({ kind: "team" })}
          notify={showToast}
          changed={setTeam}
        />
      )}
      {tab === "items" && (
        <p className="costs-microcopy">
          <Info />
          Essas informações ajudam a NEQTA a calcular margens e preços mais
          seguros.
        </p>
      )}
      {drawer?.kind === "item" && (
        <ImprovedItemDrawer
          item={drawer.item}
          suppliers={suppliers}
          categories={categoryOptions}
          items={items}
          close={() => setDrawer(null)}
          save={saveItem}
          setSuppliers={setSuppliers}
          setCategories={setCategoryOptions}
        />
      )}
      {drawer?.kind === "details" && (
        <ImprovedDetailDrawer
          item={drawer.item}
          supplier={supplierName(drawer.item.supplierId)}
          close={() => setDrawer(null)}
          affected={() => setDrawer({ kind: "affected", item: drawer.item })}
        />
      )}
      {drawer?.kind === "affected" && (
        <ImprovedAffectedDrawer
          item={drawer.item}
          close={() => setDrawer(null)}
        />
      )}
      {drawer?.kind === "purchase" && (
        <PurchaseDrawer
          item={drawer.item}
          items={items}
          suppliers={suppliers}
          close={() => setDrawer(null)}
          save={async (purchase) => {
            const current = items.find((item) => item.id === purchase.itemId);
            if (!current) return;
            const previousEffective = effectiveUnitCostForItem(current);
            const saved = await costService.save({
              ...current,
              previousUnitCost: previousEffective,
              purchasePrice: purchase.price,
              purchaseQuantity: purchase.quantity,
              purchaseUnit: purchase.unit,
              history: [
                {
                  id: `h-${Date.now()}`,
                  date: purchase.date,
                  price: purchase.price,
                  unitCost: previousEffective,
                },
                ...current.history,
              ],
            });
            await purchaseService.save(purchase);
            setPurchases((rows) => [
              purchase,
              ...rows.filter((row) => row.id !== purchase.id),
            ]);
            setItems((rows) =>
              rows.map((row) => (row.id === saved.id ? saved : row)),
            );
            setDrawer(null);
            showToast("Compra registrada.");
          }}
        />
      )}
      {drawer?.kind === "structure" && (
        <ImprovedStructureDrawer
          close={() => setDrawer(null)}
          save={(row) => {
            setStructures((current) => [...current, row]);
            setDrawer(null);
            showToast("Custo cadastrado.");
          }}
        />
      )}
      {drawer?.kind === "team" && (
        <ImprovedTeamDrawer
          close={() => setDrawer(null)}
          save={(row) => {
            setTeam((current) => [...current, row]);
            setDrawer(null);
            showToast("Custo de equipe cadastrado.");
          }}
        />
      )}
      {drawer?.kind === "import" && (
        <ImportCostsDrawer
          items={items}
          suppliers={suppliers}
          close={() => setDrawer(null)}
        />
      )}
      {toast && (
        <div className="app-toast">
          <span>
            <Check />
            {toast}
          </span>
          <button onClick={() => setToast("")} aria-label="Fechar">
            <X />
          </button>
        </div>
      )}
    </section>
  );
}

type ItemsTabProps = {
  items: CostItem[];
  allItems: CostItem[];
  supplierName: (id?: string) => string;
  query: string;
  setQuery: (v: string) => void;
  filter: Filter;
  setFilter: (v: Filter) => void;
  sortBy: (v: Sort) => void;
  action: string | null;
  setAction: (v: string | null) => void;
  setDrawer: (v: Drawer) => void;
  remove: (v: CostItem) => void;
};
function ImprovedItemsTab(props: ItemsTabProps) {
  const root = useRef<HTMLDivElement>(null);
  const activate = (target: Element) => {
    const all = Array.from(target.parentElement?.children ?? []);
    const index = all.indexOf(target);
    props.setFilter(
      index === 0 ? "adjusted" : index === 1 ? "impact" : "stale",
    );
  };
  useEffect(() => {
    const nodes = root.current?.querySelectorAll(".cost-xray-states span");
    nodes?.forEach((node, index) => {
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute(
        "aria-label",
        [
          "Filtrar por reajustes recentes",
          "Filtrar por insumos impactando produtos",
          "Filtrar por insumos sem atualização",
        ][index],
      );
    });
    root.current
      ?.querySelectorAll(".cost-actions>button")
      .forEach((button) => button.setAttribute("aria-label", "Mais ações"));
    root.current
      ?.querySelectorAll<HTMLButtonElement>(".usage-link")
      .forEach((button) => {
        if (button.textContent?.trim() === "1 produtos")
          button.textContent = "1 produto";
      });
  }, [props.items]);
  const handleXray = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest(
      ".cost-xray-states span",
    );
    if (target) activate(target);
  };
  const handleKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = (event.target as HTMLElement).closest(
      ".cost-xray-states span",
    );
    if (target) {
      event.preventDefault();
      activate(target);
    }
  };
  return (
    <div
      ref={root}
      className={`improved-items xray-${props.filter}`}
      onClick={handleXray}
      onKeyDown={handleKey}
    >
      <ItemsTab {...props} />
    </div>
  );
}
function ItemsTab({
  items,
  allItems,
  supplierName,
  query,
  setQuery,
  filter,
  setFilter,
  sortBy,
  action,
  setAction,
  setDrawer,
  remove,
}: ItemsTabProps) {
  const metrics = getCostHealthMetrics(allItems),
    recent = metrics.recentAdjustments,
    impacted = metrics.impactingProducts,
    stale = metrics.withoutRecentUpdate;
  return (
    <>
      <section className="card cost-xray">
        <div>
          <h2>Raio-X dos Insumos</h2>
          <p>Veja rapidamente quais custos precisam da sua atenção.</p>
        </div>
        <div className="cost-xray-states">
          <span>
            <b>{recent}</b>Reajustes recentes
          </span>
          <span>
            <b>{impacted}</b>Impactando produtos
          </span>
          <span>
            <b>{stale}</b>Sem atualização
          </span>
        </div>
      </section>
      <section className="product-toolbar">
        <label className="product-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar insumo..."
          />
        </label>
        <div className="filter-scroll">
          {(
            [
              ["all", "Todos"],
              ["ingredient", "Ingredientes"],
              ["packaging", "Embalagens"],
              ["adjusted", "Com reajuste"],
              ["stale", "Sem atualização"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
              key={key}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {!items.length ? (
        <section className="card cost-empty">
          <h2>Cadastre seu primeiro insumo</h2>
          <p>
            Comece pelos ingredientes ou embalagens utilizados nos seus
            produtos.
          </p>
        </section>
      ) : (
        <>
          <div className="card cost-table-wrap">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => sortBy("name")}>
                      Insumo
                      <ArrowDownUp />
                    </button>
                  </th>
                  <th>Tipo</th>
                  <th>Fornecedor</th>
                  <th>Compra</th>
                  <th>
                    <button onClick={() => sortBy("base")}>
                      Custo efetivo
                      <ArrowDownUp />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => sortBy("variation")}>
                      Variação
                      <ArrowDownUp />
                    </button>
                  </th>
                  <th>Uso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setDrawer({ kind: "details", item })}
                  >
                    <td>
                      <b>{item.name}</b>
                      <small>{item.category}</small>
                    </td>
                    <td>
                      <TypeBadge type={item.type} />
                    </td>
                    <td>{supplierName(item.supplierId)}</td>
                    <td>
                      {money(item.purchasePrice)} / {item.purchaseQuantity}{" "}
                      {item.purchaseUnit}
                    </td>
                    <td>
                      <b>
                        {money(effectiveUnitCostForItem(item))}/
                        {effectiveUnitForItem(item) ?? "unidade não informada"}
                      </b>
                    </td>
                    <td>
                      <Variation item={item} />
                    </td>
                    <td>
                      <button
                        className="usage-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawer({ kind: "affected", item });
                        }}
                      >
                        {item.usedBy.length} produtos
                      </button>
                    </td>
                    <td
                      className="cost-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setAction(action === item.id ? null : item.id)
                        }
                      >
                        <MoreHorizontal />
                      </button>
                      {action === item.id && (
                        <div className="action-menu">
                          <button
                            onClick={() => setDrawer({ kind: "details", item })}
                          >
                            Ver detalhes
                          </button>
                          <button
                            onClick={() => setDrawer({ kind: "item", item })}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              setDrawer({ kind: "purchase", item })
                            }
                          >
                            Registrar compra
                          </button>
                          <button
                            onClick={() =>
                              setDrawer({ kind: "affected", item })
                            }
                          >
                            Ver produtos afetados
                          </button>
                          <button
                            className="danger-action"
                            onClick={() => remove(item)}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cost-cards">
            {items.map((item) => (
              <article className="card" key={item.id}>
                <header>
                  <div>
                    <h2>{item.name}</h2>
                    <TypeBadge type={item.type} />
                  </div>
                  <Variation item={item} />
                </header>
                <p>
                  <span>Fornecedor</span>
                  <b>{supplierName(item.supplierId)}</b>
                </p>
                <div>
                  <span>
                    Compra atual
                    <b>
                      {money(item.purchasePrice)} / {item.purchaseQuantity}
                      {item.purchaseUnit}
                    </b>
                  </span>
                  <span>
                    Custo efetivo
                    <b>
                      {money(effectiveUnitCostForItem(item))}/
                      {effectiveUnitForItem(item) ?? "unidade não informada"}
                    </b>
                  </span>
                </div>
                <small>{item.usedBy.length} produtos utilizam este item</small>
                <button
                  className="action-row"
                  onClick={() => setDrawer({ kind: "details", item })}
                >
                  <span>Ver insumo</span>
                  <ArrowRight />
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ImprovedPurchasesTab({
  rows,
  items,
  suppliers,
  notify,
  changed,
}: {
  rows: Purchase[];
  items: CostItem[];
  suppliers: Supplier[];
  notify: (message: string) => void;
  changed: (rows: Purchase[]) => void;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "recent" | "up" | "down">("all");
  const [menu, setMenu] = useState<string | null>(null);
  const [view, setView] = useState<Purchase | null>(null);
  const [edit, setEdit] = useState<Purchase | null>(null);
  useEffect(() => setLocalRows(rows), [rows]);
  const findItem = (id: string) => items.find((item) => item.id === id);
  const findSupplier = (id?: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? "—";
  const visible = localRows.filter((row) => {
    const item = findItem(row.itemId);
    const text =
      `${item?.name ?? ""} ${findSupplier(row.supplierId)}`.toLocaleLowerCase(
        "pt-BR",
      );
    if (!text.includes(query.toLocaleLowerCase("pt-BR"))) return false;
    const change = item
      ? priceVariation(item.baseUnitCost, item.previousUnitCost)
      : null;
    if (filter === "up" && !(change && change > 0)) return false;
    if (filter === "down" && !(change && change < 0)) return false;
    if (
      filter === "recent" &&
      new Date(`${row.date}T12:00:00`).getTime() < daysAgo(30).getTime()
    )
      return false;
    return true;
  });
  const remove = (row: Purchase) => {
    if (!window.confirm("Excluir esta compra?")) return;
    setLocalRows((current) => {
      const next = current.filter((item) => item.id !== row.id);
      changed(next);
      return next;
    });
    setMenu(null);
    notify("Compra excluída.");
  };
  return (
    <section className="cost-purchases-tab">
      <div className="cost-section-heading">
        <h2>Compras</h2>
        <p>Registre novas compras para manter seus custos atualizados.</p>
      </div>
      <section className="product-toolbar purchase-toolbar">
        <label className="product-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar compra..."
          />
        </label>
        <div className="filter-scroll">
          {(
            [
              ["all", "Todos"],
              ["recent", "Últimos 30 dias"],
              ["up", "Com aumento"],
              ["down", "Com redução"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {!visible.length ? (
        <section className="card cost-empty">
          <h2>Nenhuma compra registrada.</h2>
          <p>Registre uma compra para atualizar o custo dos seus insumos.</p>
        </section>
      ) : (
        <>
          <div className="card cost-table-wrap">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Item</th>
                  <th>Fornecedor</th>
                  <th>Quantidade</th>
                  <th>Valor</th>
                  <th>Custo unitário</th>
                  <th>Variação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const item = findItem(row.itemId);
                  return (
                    <tr key={row.id} onClick={() => setView(row)}>
                      <td>{dateBR(row.date)}</td>
                      <td>
                        <b>{item?.name}</b>
                      </td>
                      <td>{findSupplier(row.supplierId)}</td>
                      <td>
                        {row.quantity} {row.unit}
                      </td>
                      <td>{money(row.price)}</td>
                      <td>
                        <b>
                          {money(
                            calculateBaseUnitCost(row.price, row.quantity),
                          )}
                          /{row.unit}
                        </b>
                      </td>
                      <td>
                        <Variation item={item} />
                      </td>
                      <td
                        className="cost-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          aria-label={`Ações de ${item?.name}`}
                          onClick={() =>
                            setMenu(menu === row.id ? null : row.id)
                          }
                        >
                          <MoreHorizontal />
                        </button>
                        {menu === row.id && (
                          <div className="action-menu">
                            <button onClick={() => setView(row)}>
                              Ver compra
                            </button>
                            <button onClick={() => setEdit(row)}>Editar</button>
                            <button
                              className="danger-action"
                              onClick={() => remove(row)}
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="cost-cards purchase-cards">
            {visible.map((row) => {
              const item = findItem(row.itemId);
              return (
                <article className="card" key={row.id}>
                  <header>
                    <div>
                      <h2>{item?.name ?? "Insumo"}</h2>
                      <small>{dateMobile(row.date)}</small>
                    </div>
                    <Variation item={item} />
                  </header>
                  <div>
                    <span>
                      Quantidade
                      <b>
                        {row.quantity} {row.unit}
                      </b>
                    </span>
                    <span>
                      Valor<b>{money(row.price)}</b>
                    </span>
                  </div>
                  <div>
                    <span>
                      Custo unitário
                      <b>
                        {money(calculateBaseUnitCost(row.price, row.quantity))}/
                        {row.unit}
                      </b>
                    </span>
                    <span>
                      Fornecedor<b>{findSupplier(row.supplierId)}</b>
                    </span>
                  </div>
                  <button className="action-row" onClick={() => setView(row)}>
                    <span>Ver compra</span>
                    <ArrowRight />
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
      {view && (
        <SimpleDrawer title="Detalhes da compra" close={() => setView(null)}>
          <div className="cost-detail purchase-detail">
            <header>
              <div>
                <h2>{findItem(view.itemId)?.name}</h2>
              </div>
              <p>{dateBR(view.date)}</p>
            </header>
            <section>
              <div className="detail-metrics">
                <span>
                  Fornecedor<b>{findSupplier(view.supplierId)}</b>
                </span>
                <span>
                  Quantidade
                  <b>
                    {view.quantity} {view.unit}
                  </b>
                </span>
                <span>
                  Valor pago<b>{money(view.price)}</b>
                </span>
                <span>
                  Custo unitário
                  <b>
                    {money(calculateBaseUnitCost(view.price, view.quantity))}/
                    {view.unit}
                  </b>
                </span>
              </div>
            </section>
            {(view.freight || view.discount || view.notes) && (
              <section>
                <h3>Mais detalhes</h3>
                {view.freight ? (
                  <p>
                    Frete <b>{money(view.freight)}</b>
                  </p>
                ) : null}
                {view.discount ? (
                  <p>
                    Desconto <b>{money(view.discount)}</b>
                  </p>
                ) : null}
                {view.notes ? <p>{view.notes}</p> : null}
              </section>
            )}
            <footer className="detail-footer">
              <button
                className={buttonClass("secondary")}
                onClick={() => {
                  setEdit(view);
                  setView(null);
                }}
              >
                Editar compra <ArrowRight />
              </button>
            </footer>
          </div>
        </SimpleDrawer>
      )}
      {edit && (
        <PurchaseEditDrawer
          purchase={edit}
          items={items}
          suppliers={suppliers}
          close={() => setEdit(null)}
          save={(updated) => {
            setLocalRows((current) => {
              const next = current.map((row) =>
                row.id === updated.id ? updated : row,
              );
              changed(next);
              return next;
            });
            setEdit(null);
            notify("Compra atualizada.");
          }}
        />
      )}
    </section>
  );
}

function PurchasesTab({
  rows,
  items,
  suppliers,
}: {
  rows: Purchase[];
  items: CostItem[];
  suppliers: Supplier[];
}) {
  return (
    <section>
      <div className="cost-section-heading">
        <h2>Compras</h2>
        <p>Registre novas compras para manter seus custos atualizados.</p>
      </div>
      <div className="card cost-table-wrap">
        <table className="cost-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Item</th>
              <th>Fornecedor</th>
              <th>Quantidade</th>
              <th>Valor</th>
              <th>Custo unitário</th>
              <th>Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const item = items.find((x) => x.id === row.itemId);
              return (
                <tr key={row.id}>
                  <td>{dateBR(row.date)}</td>
                  <td>
                    <b>{item?.name}</b>
                  </td>
                  <td>
                    {suppliers.find((x) => x.id === row.supplierId)?.name ??
                      "—"}
                  </td>
                  <td>
                    {row.quantity} {row.unit}
                  </td>
                  <td>{money(row.price)}</td>
                  <td>
                    {money(calculateBaseUnitCost(row.price, row.quantity))}/
                    {row.unit}
                  </td>
                  <td>
                    <Variation item={item} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="cost-cards purchase-cards">
        {rows.map((row) => {
          const item = items.find((x) => x.id === row.itemId);
          return (
            <article className="card" key={row.id}>
              <header>
                <div>
                  <h2>{item?.name ?? "Insumo"}</h2>
                  <small>{dateBR(row.date)}</small>
                </div>
                <Variation item={item} />
              </header>
              <p>
                <span>Fornecedor</span>
                <b>
                  {suppliers.find((x) => x.id === row.supplierId)?.name ?? "—"}
                </b>
              </p>
              <div>
                <span>
                  Quantidade
                  <b>
                    {row.quantity} {row.unit}
                  </b>
                </span>
                <span>
                  Valor da compra<b>{money(row.price)}</b>
                </span>
              </div>
              <div>
                <span>
                  Custo unitário
                  <b>
                    {money(calculateBaseUnitCost(row.price, row.quantity))}/
                    {row.unit}
                  </b>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function StructureTab({ rows }: { rows: StructureCost[] }) {
  const total = rows.reduce((sum, row) => sum + row.monthlyValue, 0);
  return (
    <section>
      <div className="cost-summary card">
        <span>
          Custo mensal informado<strong>{money(total)}</strong>
        </span>
        <span>
          Categorias configuradas
          <strong>{new Set(rows.map((x) => x.category)).size}</strong>
        </span>
      </div>
      <div className="cost-section-heading">
        <h2>Estrutura</h2>
        <p>
          Cadastre os custos mensais necessários para manter sua operação
          funcionando.
        </p>
      </div>
      <div className="cost-simple-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div>
              <b>{row.description}</b>
              <small>{row.category} · Mensal</small>
            </div>
            <strong>{money(row.monthlyValue)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
function TeamTab({ rows }: { rows: TeamCost[] }) {
  const total = rows.reduce(
    (sum, row) =>
      sum + row.salary + row.charges + row.benefits + row.otherCosts,
    0,
  );
  return (
    <section>
      <div className="cost-summary card">
        <span>
          Custo mensal total<strong>{money(total)}</strong>
        </span>
        <span>
          Funções configuradas<strong>{rows.length}</strong>
        </span>
      </div>
      <div className="cost-section-heading">
        <h2>Equipe</h2>
        <p>
          Informe o custo empregador por pessoa ou função, sem transformar a
          NEQTA em folha de pagamento.
        </p>
      </div>
      <div className="cost-simple-list team-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div>
              <b>{row.role}</b>
              <small>
                Salário {money(row.salary)} · Encargos {money(row.charges)} ·
                Benefícios {money(row.benefits)}
              </small>
            </div>
            <strong>
              {money(row.salary + row.charges + row.benefits + row.otherCosts)}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ImprovedStructureTab({
  rows,
  openNew,
  notify,
  changed,
}: {
  rows: StructureCost[];
  openNew: () => void;
  notify: (message: string) => void;
  changed: (rows: StructureCost[]) => void;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [menu, setMenu] = useState<string | null>(null);
  const [edit, setEdit] = useState<StructureCost | null>(null);
  useEffect(() => setLocalRows(rows), [rows]);
  const total = localRows.reduce((sum, row) => sum + row.monthlyValue, 0);
  const remove = (row: StructureCost) => {
    if (!window.confirm(`Excluir ${row.description}?`)) return;
    setLocalRows((current) => {
      const next = current.filter((item) => item.id !== row.id);
      changed(next);
      return next;
    });
    setMenu(null);
    notify("Custo de estrutura excluído.");
  };
  return (
    <section>
      <div className="cost-summary card">
        <span>
          Custo mensal informado<strong>{money(total)}</strong>
        </span>
        <span>
          Categorias configuradas
          <strong>{new Set(localRows.map((row) => row.category)).size}</strong>
        </span>
      </div>
      <div className="cost-section-heading">
        <h2>Estrutura</h2>
        <p>Custos mensais necessários para manter sua operação funcionando.</p>
      </div>
      {!localRows.length ? (
        <section className="card cost-empty">
          <h2>Nenhum custo de estrutura informado.</h2>
          <p>Cadastre as despesas necessárias para manter a operação.</p>
          <button className={buttonClass("primary")} onClick={openNew}>
            <Plus />
            Novo custo
          </button>
        </section>
      ) : (
        <div className="cost-simple-list">
          {localRows.map((row) => (
            <article className="card compact-cost-row" key={row.id}>
              <div>
                <b>{row.description}</b>
                <small>{row.category} · Mensal</small>
              </div>
              <strong>{money(row.monthlyValue)}</strong>
              <div className="cost-actions">
                <button
                  aria-label={`Ações de ${row.description}`}
                  onClick={() => setMenu(menu === row.id ? null : row.id)}
                >
                  <MoreHorizontal />
                </button>
                {menu === row.id && (
                  <div className="action-menu">
                    <button onClick={() => setEdit(row)}>Editar</button>
                    <button
                      className="danger-action"
                      onClick={() => remove(row)}
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && (
        <StructureEditDrawer
          row={edit}
          close={() => setEdit(null)}
          save={(updated) => {
            setLocalRows((current) => {
              const next = current.map((row) =>
                row.id === updated.id ? updated : row,
              );
              changed(next);
              return next;
            });
            setEdit(null);
            notify("Custo atualizado.");
          }}
        />
      )}
    </section>
  );
}

function ImprovedTeamTab({
  rows,
  openNew,
  notify,
  changed,
}: {
  rows: TeamCost[];
  openNew: () => void;
  notify: (message: string) => void;
  changed: (rows: TeamCost[]) => void;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [menu, setMenu] = useState<string | null>(null);
  const [edit, setEdit] = useState<TeamCost | null>(null);
  useEffect(() => setLocalRows(rows), [rows]);
  const total = localRows.reduce(
    (sum, row) =>
      sum + row.salary + row.charges + row.benefits + row.otherCosts,
    0,
  );
  const remove = (row: TeamCost) => {
    if (!window.confirm(`Excluir ${row.role}?`)) return;
    setLocalRows((current) => {
      const next = current.filter((item) => item.id !== row.id);
      changed(next);
      return next;
    });
    setMenu(null);
    notify("Custo de equipe excluído.");
  };
  return (
    <section>
      <div className="cost-summary card">
        <span>
          Custo mensal da equipe<strong>{money(total)}</strong>
        </span>
        <span>
          Funções configuradas<strong>{localRows.length}</strong>
        </span>
      </div>
      <div className="cost-section-heading">
        <h2>Equipe</h2>
        <p>
          Informe o custo da empresa por pessoa ou função. A NEQTA não substitui
          folha de pagamento.
        </p>
      </div>
      {!localRows.length ? (
        <section className="card cost-empty">
          <h2>Nenhum custo de equipe informado.</h2>
          <p>Cadastre uma pessoa ou função para calcular o custo mensal.</p>
          <button className={buttonClass("primary")} onClick={openNew}>
            <Plus />
            Novo custo de equipe
          </button>
        </section>
      ) : (
        <div className="cost-simple-list team-list">
          {localRows.map((row) => {
            const extras = row.charges + row.benefits + row.otherCosts;
            return (
              <article
                className="card compact-cost-row team-cost-row"
                key={row.id}
              >
                <div>
                  <b>{row.role}</b>
                  <small>
                    Salário {money(row.salary)} · + custos {money(extras)}
                  </small>
                </div>
                <span>
                  Custo empresa<strong>{money(row.salary + extras)}</strong>
                </span>
                <div className="cost-actions">
                  <button
                    aria-label={`Ações de ${row.role}`}
                    onClick={() => setMenu(menu === row.id ? null : row.id)}
                  >
                    <MoreHorizontal />
                  </button>
                  {menu === row.id && (
                    <div className="action-menu">
                      <button onClick={() => setEdit(row)}>Editar</button>
                      <button
                        className="danger-action"
                        onClick={() => remove(row)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {edit && (
        <TeamEditDrawer
          row={edit}
          close={() => setEdit(null)}
          save={(updated) => {
            setLocalRows((current) => {
              const next = current.map((row) =>
                row.id === updated.id ? updated : row,
              );
              changed(next);
              return next;
            });
            setEdit(null);
            notify("Custo de equipe atualizado.");
          }}
        />
      )}
    </section>
  );
}

function StructureEditDrawer({
  row,
  close,
  save,
}: {
  row: StructureCost;
  close: () => void;
  save: (row: StructureCost) => void;
}) {
  const [description, setDescription] = useState(row.description);
  const [category, setCategory] = useState(row.category);
  const [value, setValue] = useState(row.monthlyValue);
  const [allocationMode, setAllocationMode] = useState<"all" | "selected">(
    row.allocationMode ?? "all",
  );
  return (
    <SimpleDrawer title="Editar custo de estrutura" close={close}>
      <div className="cost-form">
        <p className="form-microcopy">
          Cadastre despesas necessárias para manter a operação funcionando.
        </p>
        <label>
          Descrição
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Categoria
          <CustomSelect
            value={category}
            onChange={setCategory}
            ariaLabel="Categoria"
            options={structureCategories.map((value) => ({
              value,
              label: value,
            }))}
          />
        </label>
        <label>
          Valor mensal
          <input
            inputMode="numeric"
            value={value ? money(value) : ""}
            onChange={(e) =>
              setValue(Number(e.target.value.replace(/\D/g, "")) / 100)
            }
          />
        </label>
        <label>
          Como este custo deve ser distribuído?
          <CustomSelect
            value={allocationMode}
            onChange={(value) => setAllocationMode(value as "all" | "selected")}
            ariaLabel="Distribuição do custo"
            options={[
              { value: "all", label: "Todos os produtos" },
              { value: "selected", label: "Somente produtos que utilizam" },
            ]}
          />
          <small>
            {allocationMode === "selected"
              ? "O cliente marcará o uso e a intensidade em cada produto."
              : "Indicado para aluguel, internet, contabilidade e despesas gerais."}
          </small>
        </label>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!description || !category || value <= 0}
            onClick={() =>
              save({
                ...row,
                description,
                category,
                monthlyValue: value,
                allocationMode,
              })
            }
          >
            Salvar alterações
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}
function TeamEditDrawer({
  row,
  close,
  save,
}: {
  row: TeamCost;
  close: () => void;
  save: (row: TeamCost) => void;
}) {
  const [role, setRole] = useState(row.role);
  const [salary, setSalary] = useState(row.salary);
  const [charges, setCharges] = useState(row.charges);
  const [benefits, setBenefits] = useState(row.benefits);
  const [other, setOther] = useState(row.otherCosts);
  const [direct, setDirect] = useState(Boolean(row.directProduction));
  const [hours, setHours] = useState(row.productiveHoursMonthly ?? 0);
  const field = (
    label: string,
    value: number,
    setter: (value: number) => void,
  ) => (
    <label>
      {label}
      <input
        inputMode="numeric"
        value={value ? money(value) : ""}
        onChange={(e) =>
          setter(Number(e.target.value.replace(/\D/g, "")) / 100)
        }
      />
    </label>
  );
  return (
    <SimpleDrawer title="Editar custo de equipe" close={close}>
      <div className="cost-form">
        <label>
          Nome ou função
          <input value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        {field("Salário", salary, setSalary)}
        <div className="cost-form-grid">
          {field("Encargos", charges, setCharges)}
          {field("Benefícios", benefits, setBenefits)}
        </div>
        {field("Outros custos", other, setOther)}
        <label className="settings-toggle">
          <span>
            Trabalha diretamente na produção?
            <small>
              O custo será calculado pelos minutos usados em cada produto, sem
              entrar novamente no rateio geral.
            </small>
          </span>
          <input
            type="checkbox"
            checked={direct}
            onChange={() => setDirect(!direct)}
          />
        </label>
        {direct && (
          <label>
            Horas produtivas por mês
            <input
              inputMode="decimal"
              value={hours || ""}
              onChange={(e) =>
                setHours(Number(e.target.value.replace(",", ".")) || 0)
              }
              placeholder="Ex.: 160"
            />
          </label>
        )}
        <div className="calculated-cost">
          <span>Custo empresa</span>
          <strong>{money(salary + charges + benefits + other)}</strong>
        </div>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!role || salary <= 0 || (direct && hours <= 0)}
            onClick={() =>
              save({
                ...row,
                role,
                salary,
                charges,
                benefits,
                otherCosts: other,
                directProduction: direct,
                productiveHoursMonthly: direct ? hours : 0,
              })
            }
          >
            Salvar alterações
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}

function ImprovedItemDrawer({
  item,
  suppliers,
  categories,
  items,
  close,
  save,
  setSuppliers,
  setCategories,
}: {
  item?: CostItem;
  suppliers: Supplier[];
  categories: string[];
  items: CostItem[];
  close: () => void;
  save: (item: CostItem) => void;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<CostItemType>(item?.type ?? "ingredient");
  const [category, setCategory] = useState(item?.category ?? "");
  const [supplierId, setSupplier] = useState(item?.supplierId ?? "");
  const [price, setPrice] = useState(item?.purchasePrice ?? 0);
  const [quantity, setQuantity] = useState(item?.purchaseQuantity ?? 0);
  const [unit, setUnit] = useState<PurchaseUnit>(item?.purchaseUnit ?? "kg");
  const [packageContentQuantity, setPackageContentQuantity] = useState(
    item?.packageContentQuantity ?? 0,
  );
  const [packageContentUnit, setPackageContentUnit] =
    useState<BasePurchaseUnit>(item?.packageContentUnit ?? "un");
  const [advanced, setAdvanced] = useState(false);
  const [freight, setFreight] = useState(item?.freight ?? 0);
  const [discount, setDiscount] = useState(item?.discount ?? 0);
  const [loss, setLoss] = useState(item?.lossPercentage ?? 0);
  const [purchaseDate, setPurchaseDate] = useState(item?.purchaseDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [manager, setManager] = useState<
    | "newSupplier"
    | "manageSuppliers"
    | "newCategory"
    | "manageCategories"
    | null
  >(null);
  const [supplierDraft, setSupplierDraft] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
  });
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [managerMessage, setManagerMessage] = useState("");
  const base = calculateBaseUnitCost(price, quantity);
  const commercialPackage = unit === "cx" || unit === "pct";
  const effective = calculateEffectiveUnitCost(
    price,
    quantity,
    freight,
    discount,
    loss,
    commercialPackage ? packageContentQuantity : 1,
  );
  const effectiveUnit = commercialPackage ? packageContentUnit : unit;
  const hasAdvanced = freight > 0 || discount > 0 || loss > 0;
  const valid = Boolean(
    name.trim() &&
    price > 0 &&
    quantity > 0 &&
    unit &&
    (!commercialPackage || packageContentQuantity > 0),
  );
  const commitSupplier = () => {
    if (!supplierDraft.name.trim()) return;
    const supplier: Supplier = {
      id: editingSupplier ?? `fornecedor-${Date.now()}`,
      name: supplierDraft.name.trim(),
      contact: supplierDraft.contact.trim() || undefined,
      phone: supplierDraft.phone.trim() || undefined,
      email: supplierDraft.email.trim() || undefined,
      active: true,
    };
    setSuppliers((current) =>
      editingSupplier
        ? current.map((value) =>
            value.id === editingSupplier ? supplier : value,
          )
        : [...current, supplier],
    );
    setSupplier(supplier.id);
    setManager(null);
    setEditingSupplier(null);
    setSupplierDraft({ name: "", contact: "", phone: "", email: "" });
  };
  const commitCategory = () => {
    const value = categoryDraft.trim();
    if (!value) return;
    setCategories((current) =>
      editingCategory
        ? current.map((category) =>
            category === editingCategory ? value : category,
          )
        : current.includes(value)
          ? current
          : [...current, value],
    );
    setCategory(value);
    setManager(null);
    setEditingCategory(null);
    setCategoryDraft("");
  };
  const submit = () =>
    save({
      ...item,
      id: item?.id ?? `insumo-${Date.now()}`,
      name: name.trim(),
      type,
      category,
      supplierId,
      purchasePrice: price,
      purchaseQuantity: quantity,
      purchaseUnit: unit,
      baseUnitCost: base,
      effectiveUnitCost: effective,
      packageContentQuantity: commercialPackage
        ? packageContentQuantity
        : undefined,
      packageContentUnit: commercialPackage ? packageContentUnit : undefined,
      freight,
      discount,
      lossPercentage: loss,
      purchaseDate,
      notes,
      usedBy: item?.usedBy ?? [],
      history: item?.history ?? [],
      createdAt: item?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  return (
    <SimpleDrawer title={item ? "Editar insumo" : "Novo insumo"} close={close}>
      <div className="cost-form">
        <section>
          <h3>Identificação</h3>
          <label>
            Nome do insumo *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Carne bovina"
            />
          </label>
          <div className="cost-form-grid">
            <label>
              Tipo *
              <CustomSelect
                value={type}
                onChange={(v) => setType(v as CostItemType)}
                ariaLabel="Tipo"
                options={[
                  { value: "ingredient", label: "Ingrediente" },
                  { value: "packaging", label: "Embalagem" },
                ]}
              />
            </label>
            <label>
              Categoria
              <CustomSelect
                value={category}
                onChange={setCategory}
                ariaLabel="Categoria"
                placeholder="Selecione..."
                options={categories.map((x) => ({ value: x, label: x }))}
                actions={[
                  {
                    label: "+ Nova categoria",
                    onSelect: () => {
                      setCategoryDraft("");
                      setEditingCategory(null);
                      setManager("newCategory");
                    },
                  },
                  {
                    label: "Gerenciar categorias",
                    onSelect: () => setManager("manageCategories"),
                  },
                ]}
              />
            </label>
          </div>
          <label>
            Fornecedor
            <CustomSelect
              value={supplierId}
              onChange={setSupplier}
              ariaLabel="Fornecedor"
              placeholder="Selecione um fornecedor..."
              options={suppliers
                .filter((value) => value.active !== false)
                .map((x) => ({ value: x.id, label: x.name }))}
              actions={[
                {
                  label: "+ Novo fornecedor",
                  onSelect: () => {
                    setSupplierDraft({
                      name: "",
                      contact: "",
                      phone: "",
                      email: "",
                    });
                    setEditingSupplier(null);
                    setManager("newSupplier");
                  },
                },
                {
                  label: "Gerenciar fornecedores",
                  onSelect: () => setManager("manageSuppliers"),
                },
              ]}
            />
          </label>
        </section>
        <section>
          <h3>Compra</h3>
          <p>Como você compra este item?</p>
          <label>
            Preço pago *
            <input
              inputMode="numeric"
              value={price ? money(price) : ""}
              onChange={(e) =>
                setPrice(Number(e.target.value.replace(/\D/g, "")) / 100)
              }
              placeholder="R$ 0,00"
            />
          </label>
          <div className="cost-form-grid">
            <label>
              Quantidade comprada *
              <input
                inputMode="decimal"
                value={quantity || ""}
                onChange={(e) => setQuantity(decimal(e.target.value))}
                placeholder="0"
              />
            </label>
            <label>
              Unidade *
              <CustomSelect
                value={unit}
                onChange={(v) => setUnit(v as PurchaseUnit)}
                ariaLabel="Unidade"
                options={unitOptions.map((x) => ({ value: x, label: x }))}
              />
            </label>
          </div>
          {commercialPackage && (
            <div className="cost-form-grid">
              <label>
                Conteúdo por {unit === "cx" ? "caixa" : "pacote"} *
                <input
                  inputMode="decimal"
                  value={packageContentQuantity || ""}
                  onChange={(e) =>
                    setPackageContentQuantity(decimal(e.target.value))
                  }
                  placeholder="Ex.: 24"
                />
              </label>
              <label>
                Unidade do conteúdo *
                <CustomSelect
                  value={packageContentUnit}
                  onChange={(v) => setPackageContentUnit(v as BasePurchaseUnit)}
                  ariaLabel="Unidade do conteúdo"
                  options={baseUnitOptions.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </label>
            </div>
          )}
          <div className="calculated-cost">
            <span>Custo que entra nos produtos</span>
            <strong>
              {effective ? `${money(effective)}/${effectiveUnit}` : "—"}
            </strong>
            {commercialPackage && base > 0 && (
              <small>
                Compra: {money(base)}/{unit} · convertido automaticamente pelo
                conteúdo informado.
              </small>
            )}
          </div>
          <button
            type="button"
            className="advanced-toggle purchase-accordion"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
          >
            <span>
              <b>Mais detalhes da compra</b>
              <small>Frete, desconto, perda e observações</small>
            </span>
            <ChevronDown className={advanced ? "open" : ""} />
          </button>
          {advanced && (
            <div className="advanced-fields">
              <div className="cost-form-grid">
                <label>
                  Frete
                  <input
                    inputMode="numeric"
                    value={freight ? money(freight) : ""}
                    onChange={(e) =>
                      setFreight(
                        Number(e.target.value.replace(/\D/g, "")) / 100,
                      )
                    }
                    placeholder="R$ 0,00"
                  />
                </label>
                <label>
                  Desconto
                  <input
                    inputMode="numeric"
                    value={discount ? money(discount) : ""}
                    onChange={(e) =>
                      setDiscount(
                        Number(e.target.value.replace(/\D/g, "")) / 100,
                      )
                    }
                    placeholder="R$ 0,00"
                  />
                </label>
                <label>
                  Perda estimada (%)
                  <input
                    inputMode="decimal"
                    value={loss || ""}
                    onChange={(e) => setLoss(decimal(e.target.value))}
                    placeholder="0"
                  />
                </label>
                <label>
                  Data da compra
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Observações
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {hasAdvanced && !commercialPackage && (
                <div className="effective-cost">
                  <Info />
                  <span>
                    Custo da compra
                    <strong>
                      {money(base)}/{unit}
                    </strong>
                    <small>
                      Custo efetivo: {money(effective)}/{effectiveUnit}.
                      Considera conteúdo, frete, descontos e perdas informadas.
                    </small>
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
        {item && item.usedBy.length > 0 && base !== item.baseUnitCost && (
          <div className="impact-alert">
            <Info />
            <span>
              <b>Essa alteração afeta {item.usedBy.length} produtos.</b>
              <small>
                {item.usedBy.slice(0, 3).join(", ")}
                {item.usedBy.length > 3
                  ? ` +${item.usedBy.length - 3} produtos`
                  : ""}
              </small>
            </span>
          </div>
        )}
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!valid}
            onClick={submit}
          >
            {item && base !== item.baseUnitCost
              ? "Atualizar custo"
              : "Salvar insumo"}
          </button>
        </footer>
      </div>
      {manager === "newSupplier" && (
        <div
          className="nested-modal"
          role="dialog"
          aria-modal="true"
          aria-label={editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}
        >
          <div className="nested-modal-card">
            <header>
              <h3>
                {editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}
              </h3>
              <button onClick={() => setManager(null)} aria-label="Fechar">
                <X />
              </button>
            </header>
            <label>
              Nome do fornecedor *
              <input
                value={supplierDraft.name}
                onChange={(e) =>
                  setSupplierDraft((v) => ({ ...v, name: e.target.value }))
                }
              />
            </label>
            <label>
              Contato
              <input
                value={supplierDraft.contact}
                onChange={(e) =>
                  setSupplierDraft((v) => ({ ...v, contact: e.target.value }))
                }
              />
            </label>
            <label>
              Telefone
              <input
                value={supplierDraft.phone}
                onChange={(e) =>
                  setSupplierDraft((v) => ({ ...v, phone: e.target.value }))
                }
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={supplierDraft.email}
                onChange={(e) =>
                  setSupplierDraft((v) => ({ ...v, email: e.target.value }))
                }
              />
            </label>
            <footer>
              <button
                className={buttonClass("ghost")}
                onClick={() => setManager(null)}
              >
                Cancelar
              </button>
              <button
                className={buttonClass("primary")}
                disabled={!supplierDraft.name.trim()}
                onClick={commitSupplier}
              >
                Salvar fornecedor
              </button>
            </footer>
          </div>
        </div>
      )}
      {manager === "newCategory" && (
        <div
          className="nested-modal"
          role="dialog"
          aria-modal="true"
          aria-label={editingCategory ? "Editar categoria" : "Nova categoria"}
        >
          <div className="nested-modal-card">
            <header>
              <h3>{editingCategory ? "Editar categoria" : "Nova categoria"}</h3>
              <button onClick={() => setManager(null)} aria-label="Fechar">
                <X />
              </button>
            </header>
            <label>
              Nome da categoria
              <input
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                autoFocus
              />
            </label>
            <footer>
              <button
                className={buttonClass("ghost")}
                onClick={() => setManager(null)}
              >
                Cancelar
              </button>
              <button
                className={buttonClass("primary")}
                disabled={!categoryDraft.trim()}
                onClick={commitCategory}
              >
                {editingCategory ? "Salvar alteração" : "Adicionar categoria"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {manager === "manageCategories" && (
        <div
          className="nested-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar categorias"
        >
          <div className="nested-modal-card manager-card">
            <header>
              <h3>Gerenciar categorias</h3>
              <button onClick={() => setManager(null)} aria-label="Fechar">
                <X />
              </button>
            </header>
            {managerMessage && (
              <p className="manager-message">{managerMessage}</p>
            )}
            <div className="manager-list">
              {categories.map((value) => {
                const usage = items.filter(
                  (current) => current.category === value,
                ).length;
                return (
                  <div key={value}>
                    <b>{value}</b>
                    <span>
                      <button
                        onClick={() => {
                          setEditingCategory(value);
                          setCategoryDraft(value);
                          setManager("newCategory");
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => {
                          if (usage) {
                            setManagerMessage(
                              `Esta categoria está sendo usada por ${usage} insumo${usage > 1 ? "s" : ""}. Mova os itens antes de excluir.`,
                            );
                            return;
                          }
                          setCategories((current) =>
                            current.filter((category) => category !== value),
                          );
                        }}
                      >
                        Excluir
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              className={buttonClass("secondary")}
              onClick={() => {
                setEditingCategory(null);
                setCategoryDraft("");
                setManager("newCategory");
              }}
            >
              <Plus />
              Nova categoria
            </button>
          </div>
        </div>
      )}
      {manager === "manageSuppliers" && (
        <div
          className="nested-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar fornecedores"
        >
          <div className="nested-modal-card manager-card">
            <header>
              <h3>Gerenciar fornecedores</h3>
              <button onClick={() => setManager(null)} aria-label="Fechar">
                <X />
              </button>
            </header>
            <div className="manager-list">
              {suppliers.map((value) => {
                const used = items.some(
                  (current) => current.supplierId === value.id,
                );
                return (
                  <div key={value.id}>
                    <span>
                      <b>{value.name}</b>
                      {value.active === false && <small>Desativado</small>}
                    </span>
                    <span>
                      <button
                        onClick={() => {
                          setEditingSupplier(value.id);
                          setSupplierDraft({
                            name: value.name,
                            contact: value.contact ?? "",
                            phone: value.phone ?? "",
                            email: value.email ?? "",
                          });
                          setManager("newSupplier");
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className={
                          value.active === false
                            ? "success-text"
                            : "danger-text"
                        }
                        onClick={() =>
                          setSuppliers((current) =>
                            current.map((supplier) =>
                              supplier.id === value.id
                                ? {
                                    ...supplier,
                                    active:
                                      value.active === false ? true : false,
                                  }
                                : supplier,
                            ),
                          )
                        }
                      >
                        {value.active === false
                          ? "Reativar"
                          : used
                            ? "Desativar"
                            : "Excluir"}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              className={buttonClass("secondary")}
              onClick={() => {
                setEditingSupplier(null);
                setSupplierDraft({
                  name: "",
                  contact: "",
                  phone: "",
                  email: "",
                });
                setManager("newSupplier");
              }}
            >
              <Plus />
              Novo fornecedor
            </button>
          </div>
        </div>
      )}
    </SimpleDrawer>
  );
}

function ItemDrawer({
  item,
  suppliers,
  close,
  save,
}: {
  item?: CostItem;
  suppliers: Supplier[];
  close: () => void;
  save: (item: CostItem) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<CostItemType>(item?.type ?? "ingredient");
  const [category, setCategory] = useState(item?.category ?? "");
  const [supplierId, setSupplier] = useState(item?.supplierId ?? "");
  const [price, setPrice] = useState(item?.purchasePrice ?? 0);
  const [quantity, setQuantity] = useState(item?.purchaseQuantity ?? 0);
  const [unit, setUnit] = useState<PurchaseUnit>(item?.purchaseUnit ?? "kg");
  const [advanced, setAdvanced] = useState(false);
  const [freight, setFreight] = useState(item?.freight ?? 0);
  const [discount, setDiscount] = useState(item?.discount ?? 0);
  const [loss, setLoss] = useState(item?.lossPercentage ?? 0);
  const base = calculateBaseUnitCost(price, quantity),
    effective = calculateEffectiveUnitCost(
      price,
      quantity,
      freight,
      discount,
      loss,
    ),
    valid = Boolean(name.trim() && type && price > 0 && quantity > 0 && unit);
  return (
    <SimpleDrawer title={item ? "Editar insumo" : "Novo insumo"} close={close}>
      <div className="cost-form">
        <section>
          <h3>Identificação</h3>
          <label>
            Nome do insumo *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Carne bovina"
            />
          </label>
          <div className="cost-form-grid">
            <label>
              Tipo *
              <CustomSelect
                value={type}
                onChange={(v) => setType(v as CostItemType)}
                ariaLabel="Tipo"
                options={[
                  { value: "ingredient", label: "Ingrediente" },
                  { value: "packaging", label: "Embalagem" },
                ]}
              />
            </label>
            <label>
              Categoria
              <CustomSelect
                value={category}
                onChange={setCategory}
                ariaLabel="Categoria"
                placeholder="Selecione..."
                options={categories.map((x) => ({ value: x, label: x }))}
              />
            </label>
          </div>
          <label>
            Fornecedor
            <CustomSelect
              value={supplierId}
              onChange={setSupplier}
              ariaLabel="Fornecedor"
              placeholder="Selecione um fornecedor..."
              options={suppliers.map((x) => ({ value: x.id, label: x.name }))}
            />
          </label>
          <button className="cost-inline-link">
            <Plus />
            Novo fornecedor
          </button>
        </section>
        <section>
          <h3>Compra</h3>
          <p>Como você compra este item?</p>
          <label>
            Preço pago *
            <input
              value={price ? money(price) : ""}
              onChange={(e) =>
                setPrice(Number(e.target.value.replace(/\D/g, "")) / 100)
              }
              placeholder="R$ 0,00"
            />
          </label>
          <div className="cost-form-grid">
            <label>
              Quantidade comprada *
              <input
                value={quantity || ""}
                onChange={(e) => setQuantity(decimal(e.target.value))}
                placeholder="0"
              />
            </label>
            <label>
              Unidade *
              <CustomSelect
                value={unit}
                onChange={(v) => setUnit(v as PurchaseUnit)}
                ariaLabel="Unidade"
                options={unitOptions.map((x) => ({ value: x, label: x }))}
              />
            </label>
          </div>
          <div className="calculated-cost">
            <span>Custo calculado</span>
            <strong>{base ? `${money(base)}/${unit}` : "—"}</strong>
          </div>
          <button
            className="advanced-toggle"
            onClick={() => setAdvanced((v) => !v)}
          >
            Mais detalhes da compra{" "}
            <ChevronDown className={advanced ? "open" : ""} />
          </button>
          {advanced && (
            <div className="advanced-fields">
              <div className="cost-form-grid">
                <label>
                  Frete
                  <input
                    value={freight ? money(freight) : ""}
                    onChange={(e) =>
                      setFreight(
                        Number(e.target.value.replace(/\D/g, "")) / 100,
                      )
                    }
                    placeholder="R$ 0,00"
                  />
                </label>
                <label>
                  Desconto
                  <input
                    value={discount ? money(discount) : ""}
                    onChange={(e) =>
                      setDiscount(
                        Number(e.target.value.replace(/\D/g, "")) / 100,
                      )
                    }
                    placeholder="R$ 0,00"
                  />
                </label>
                <label>
                  Perda estimada (%)
                  <input
                    value={loss || ""}
                    onChange={(e) => setLoss(decimal(e.target.value))}
                    placeholder="0"
                  />
                </label>
                <label>
                  Data da compra
                  <input type="date" defaultValue={item?.purchaseDate} />
                </label>
              </div>
              <label>
                Observações
                <textarea defaultValue={item?.notes} />
              </label>
              <div className="effective-cost">
                <Info />
                <span>
                  Custo efetivo
                  <strong>
                    {effective ? `${money(effective)}/${unit}` : "—"}
                  </strong>
                  <small>Considera perdas, frete e descontos informados.</small>
                </span>
              </div>
            </div>
          )}
        </section>
        {item && item.usedBy.length > 0 && base !== item.baseUnitCost && (
          <div className="impact-alert">
            <Info />
            <span>
              <b>Essa alteração impactará {item.usedBy.length} produtos.</b>
              <small>{item.usedBy.slice(0, 3).join(", ")}</small>
            </span>
          </div>
        )}
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!valid}
            onClick={() =>
              save({
                ...item,
                id: item?.id ?? `insumo-${Date.now()}`,
                name: name.trim(),
                type,
                category,
                supplierId,
                purchasePrice: price,
                purchaseQuantity: quantity,
                purchaseUnit: unit,
                baseUnitCost: base,
                freight,
                discount,
                lossPercentage: loss,
                usedBy: item?.usedBy ?? [],
                history: item?.history ?? [],
                createdAt: item?.createdAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          >
            {item && base !== item.baseUnitCost
              ? "Atualizar custo"
              : "Salvar insumo"}
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}

function ImprovedDetailDrawer({
  item,
  supplier,
  close,
  affected,
}: {
  item: CostItem;
  supplier: string;
  close: () => void;
  affected: () => void;
}) {
  const history = item.history.slice(0, 3);
  return (
    <SimpleDrawer title="Detalhes do insumo" close={close}>
      <div className="cost-detail improved-cost-detail">
        <header>
          <div>
            <h2>{item.name}</h2>
            <TypeBadge type={item.type} />
          </div>
          <p>{supplier}</p>
        </header>
        <section>
          <h3>Compra atual</h3>
          <div className="detail-metrics">
            <span>
              Preço pago<b>{money(item.purchasePrice)}</b>
            </span>
            <span>
              Quantidade
              <b>
                {item.purchaseQuantity} {item.purchaseUnit}
              </b>
            </span>
            <span>
              Custo efetivo
              <b>
                {money(effectiveUnitCostForItem(item))}/
                {effectiveUnitForItem(item) ?? "unidade não informada"}
              </b>
            </span>
            <span>
              Variação
              <b>
                <Variation item={item} />
              </b>
            </span>
          </div>
        </section>
        <section>
          <h3>Histórico recente</h3>
          {history.length ? (
            history.map((row, index) => {
              const older = item.history[index + 1];
              const change = older?.unitCost
                ? ((row.unitCost - older.unitCost) / older.unitCost) * 100
                : null;
              return (
                <div className="history-row detailed-history" key={row.id}>
                  <span>
                    <b>{dateBR(row.date)}</b>
                    {history.length === 1 && (
                      <small>Primeira compra registrada</small>
                    )}
                  </span>
                  <span>
                    <b>
                      {money(row.unitCost)}/{item.purchaseUnit}
                    </b>
                    {change !== null && (
                      <small
                        className={
                          change > 10
                            ? "danger-text"
                            : change >= 5
                              ? "warning-text"
                              : change < 0
                                ? "success-text"
                                : ""
                        }
                      >
                        {variationLabel(change)}
                      </small>
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="empty-copy">Nenhuma compra anterior registrada.</p>
          )}
          {item.history.length > 3 && (
            <button className="history-more">
              Ver histórico completo <ArrowRight />
            </button>
          )}
        </section>
        <section>
          <h3>Produtos afetados</h3>
          <button className="affected-summary" onClick={affected}>
            <span>
              {item.usedBy.length
                ? productUsageLabel(item.usedBy.length)
                : "Este insumo ainda não é utilizado em nenhum produto."}
            </span>
            <ArrowRight />
          </button>
        </section>
      </div>
    </SimpleDrawer>
  );
}

function ImprovedAffectedDrawer({
  item,
  close,
}: {
  item: CostItem;
  close: () => void;
}) {
  const products =
    item.affectedProducts ??
    item.usedBy.map((name, index) => ({
      productId: `${item.id}-${index}`,
      name,
      category: "Produtos",
      margin: 0,
    }));
  return (
    <SimpleDrawer title="Produtos afetados" close={close}>
      <div className="affected-list improved-affected-list">
        {products.length ? (
          <>
            <p>
              Este insumo está sendo utilizado em{" "}
              {productCountLabel(products.length)}.
            </p>
            {products.map((product) => (
              <a
                href={`/produtos?produto=${encodeURIComponent(product.productId)}`}
                key={product.productId}
              >
                <span>
                  <b>{product.name}</b>
                  <small>{product.category}</small>
                </span>
                <span>
                  <small>
                    Margem {product.margin.toFixed(1).replace(".", ",")}%
                  </small>
                  <ArrowRight />
                </span>
              </a>
            ))}
          </>
        ) : (
          <p className="empty-copy">
            Este insumo ainda não é utilizado em nenhum produto.
          </p>
        )}
      </div>
    </SimpleDrawer>
  );
}

function DetailDrawer({
  item,
  supplier,
  close,
  affected,
}: {
  item: CostItem;
  supplier: string;
  close: () => void;
  affected: () => void;
}) {
  return (
    <SimpleDrawer title="Detalhes do insumo" close={close}>
      <div className="cost-detail">
        <header>
          <div>
            <h2>{item.name}</h2>
            <TypeBadge type={item.type} />
          </div>
          <p>{supplier}</p>
        </header>
        <section>
          <h3>Compra atual</h3>
          <div className="detail-metrics">
            <span>
              Preço pago<b>{money(item.purchasePrice)}</b>
            </span>
            <span>
              Quantidade
              <b>
                {item.purchaseQuantity} {item.purchaseUnit}
              </b>
            </span>
            <span>
              Custo efetivo
              <b>
                {money(effectiveUnitCostForItem(item))}/
                {effectiveUnitForItem(item) ?? "unidade não informada"}
              </b>
            </span>
            <span>
              Variação
              <b>
                <Variation item={item} />
              </b>
            </span>
          </div>
        </section>
        <section>
          <h3>Histórico recente</h3>
          {item.history.length ? (
            item.history.map((row) => (
              <p className="history-row" key={row.id}>
                <span>{dateBR(row.date)}</span>
                <b>
                  {money(row.unitCost)}/{item.purchaseUnit}
                </b>
              </p>
            ))
          ) : (
            <p className="empty-copy">Nenhum histórico registrado.</p>
          )}
        </section>
        <section>
          <h3>Produtos afetados</h3>
          <button className="affected-summary" onClick={affected}>
            {item.usedBy.length} produtos utilizam este item
            <ArrowRight />
          </button>
        </section>
      </div>
    </SimpleDrawer>
  );
}
function AffectedDrawer({
  item,
  close,
}: {
  item: CostItem;
  close: () => void;
}) {
  return (
    <SimpleDrawer title="Produtos afetados" close={close}>
      <div className="affected-list">
        <p>
          Este insumo está sendo utilizado em {item.usedBy.length} produtos.
        </p>
        {item.usedBy.map((name) => (
          <a href={`/produtos?busca=${encodeURIComponent(name)}`} key={name}>
            <b>{name}</b>
            <ArrowRight />
          </a>
        ))}
        <button className={buttonClass("secondary")} onClick={close}>
          Fechar
        </button>
      </div>
    </SimpleDrawer>
  );
}

function PurchaseEditDrawer({
  purchase,
  items,
  suppliers,
  close,
  save,
}: {
  purchase: Purchase;
  items: CostItem[];
  suppliers: Supplier[];
  close: () => void;
  save: (purchase: Purchase) => void | Promise<void>;
}) {
  const [itemId, setItemId] = useState(purchase.itemId);
  const [supplierId, setSupplier] = useState(purchase.supplierId ?? "");
  const [date, setDate] = useState(purchase.date);
  const [quantity, setQuantity] = useState(purchase.quantity);
  const [unit, setUnit] = useState<PurchaseUnit>(purchase.unit);
  const [price, setPrice] = useState(purchase.price);
  const selected = items.find((item) => item.id === itemId);
  const nextCost = calculateBaseUnitCost(price, quantity);
  const previous = selected?.baseUnitCost ?? 0;
  const change = previous > 0 ? ((nextCost - previous) / previous) * 100 : null;
  const valid = Boolean(
    itemId &&
    date &&
    quantity > 0 &&
    price > 0 &&
    selected &&
    unit === selected.purchaseUnit,
  );
  const packageFactor =
    selected && (unit === "cx" || unit === "pct")
      ? (selected.packageContentQuantity ?? 0)
      : 1;
  const resultUnit = selected ? effectiveUnitForItem(selected) : null;
  return (
    <SimpleDrawer title="Editar compra" close={close}>
      <div className="cost-form">
        <label>
          Insumo
          <CustomSelect
            value={itemId}
            onChange={(value) => {
              setItemId(value);
              const found = items.find((item) => item.id === value);
              if (found) {
                setSupplier(found.supplierId ?? "");
                setUnit(found.purchaseUnit);
              }
            }}
            ariaLabel="Insumo"
            options={items.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </label>
        <label>
          Fornecedor
          <CustomSelect
            value={supplierId}
            onChange={setSupplier}
            ariaLabel="Fornecedor"
            placeholder="Selecione..."
            options={suppliers.map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            }))}
          />
        </label>
        <label>
          Data
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="cost-form-grid">
          <label>
            Quantidade
            <input
              inputMode="decimal"
              value={quantity || ""}
              onChange={(event) => setQuantity(decimal(event.target.value))}
            />
          </label>
          <label>
            Unidade
            <CustomSelect
              value={unit}
              onChange={(value) => setUnit(value as PurchaseUnit)}
              ariaLabel="Unidade"
              options={unitOptions.map((value) => ({ value, label: value }))}
            />
          </label>
        </div>
        <label>
          Preço pago
          <input
            inputMode="numeric"
            value={price ? money(price) : ""}
            onChange={(event) =>
              setPrice(Number(event.target.value.replace(/\D/g, "")) / 100)
            }
            placeholder="R$ 0,00"
          />
        </label>
        {nextCost > 0 && (
          <div className="purchase-preview">
            <small>Custo calculado</small>
            <strong>
              {money(nextCost)}/{unit}
            </strong>
            {previous > 0 && (
              <div>
                <span>
                  Anterior{" "}
                  <b>
                    {money(previous)}/{unit}
                  </b>
                </span>
                <span>
                  Novo{" "}
                  <b>
                    {money(nextCost)}/{unit}
                  </b>
                </span>
                <span>
                  Variação{" "}
                  <b
                    className={
                      change && change > 10
                        ? "danger-text"
                        : change && change >= 5
                          ? "warning-text"
                          : change && change < 0
                            ? "success-text"
                            : ""
                    }
                  >
                    {change === null ? "—" : variationLabel(change)}
                  </b>
                </span>
              </div>
            )}
          </div>
        )}
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!valid}
            onClick={() =>
              save({
                ...purchase,
                itemId,
                supplierId,
                date,
                quantity,
                unit,
                price,
              })
            }
          >
            Salvar alterações
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}
function PurchaseDrawer({
  item,
  items,
  suppliers,
  close,
  save,
}: {
  item?: CostItem;
  items: CostItem[];
  suppliers: Supplier[];
  close: () => void;
  save: (purchase: Purchase) => void | Promise<void>;
}) {
  const [itemId, setItem] = useState(item?.id ?? "");
  const selected = items.find((x) => x.id === itemId);
  const [supplierId, setSupplier] = useState(item?.supplierId ?? "");
  const [date, setDate] = useState(todayISO);
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState<PurchaseUnit>(item?.purchaseUnit ?? "kg");
  const [price, setPrice] = useState(0);
  const valid = Boolean(
    itemId &&
    date &&
    quantity > 0 &&
    price > 0 &&
    selected &&
    unit === selected.purchaseUnit,
  );
  const packageFactor =
    selected && (unit === "cx" || unit === "pct")
      ? (selected.packageContentQuantity ?? 0)
      : 1;
  const resultUnit = selected ? effectiveUnitForItem(selected) : null;
  return (
    <SimpleDrawer title="Registrar compra" close={close}>
      <div className="cost-form">
        <label>
          Insumo
          <CustomSelect
            value={itemId}
            onChange={(v) => {
              setItem(v);
              const found = items.find((x) => x.id === v);
              if (found) {
                setSupplier(found.supplierId ?? "");
                setUnit(found.purchaseUnit);
              }
            }}
            ariaLabel="Insumo"
            placeholder="Selecione um insumo..."
            options={items.map((x) => ({ value: x.id, label: x.name }))}
          />
        </label>
        <label>
          Fornecedor
          <CustomSelect
            value={supplierId}
            onChange={setSupplier}
            ariaLabel="Fornecedor"
            placeholder="Selecione..."
            options={suppliers.map((x) => ({ value: x.id, label: x.name }))}
          />
        </label>
        <label>
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="cost-form-grid">
          <label>
            Quantidade
            <input
              value={quantity || ""}
              onChange={(e) => setQuantity(decimal(e.target.value))}
            />
          </label>
          <label>
            Unidade
            <CustomSelect
              value={unit}
              onChange={(v) => setUnit(v as PurchaseUnit)}
              ariaLabel="Unidade"
              options={(selected ? [selected.purchaseUnit] : unitOptions).map(
                (x) => ({ value: x, label: x }),
              )}
            />
            {selected && (
              <small>
                Para manter o cálculo correto, registre a compra na mesma
                unidade cadastrada no insumo.
              </small>
            )}
          </label>
        </div>
        <label>
          Preço pago
          <input
            value={price ? money(price) : ""}
            onChange={(e) =>
              setPrice(Number(e.target.value.replace(/\D/g, "")) / 100)
            }
            placeholder="R$ 0,00"
          />
        </label>
        {selected && quantity > 0 && price > 0 && (
          <div className="calculated-cost">
            <span>Novo custo unitário</span>
            <strong>
              {money(
                calculateEffectiveUnitCost(
                  price,
                  quantity,
                  0,
                  0,
                  0,
                  packageFactor,
                ),
              )}
              /{resultUnit ?? "—"}
            </strong>
          </div>
        )}
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!valid}
            onClick={() =>
              save({
                id: `compra-${Date.now()}`,
                itemId,
                supplierId,
                date,
                quantity,
                unit,
                price,
              })
            }
          >
            Registrar compra
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}

function CostTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="cost-tooltip">
      <button
        type="button"
        aria-label="Mais informações"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
      >
        <Info />
      </button>
      {open && <span role="tooltip">{text}</span>}
    </span>
  );
}
function ImprovedStructureDrawer({
  close,
  save,
}: {
  close: () => void;
  save: (row: StructureCost) => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState(0);
  const [allocationMode, setAllocationMode] = useState<"all" | "selected">(
    "all",
  );
  return (
    <SimpleDrawer title="Novo custo de estrutura" close={close}>
      <div className="cost-form">
        <p className="form-microcopy">
          Cadastre a conta mensal; a NEQTA fará a distribuição.
        </p>
        <label>
          Descrição
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Conta de gás"
          />
        </label>
        <label>
          Categoria
          <CustomSelect
            value={category}
            onChange={setCategory}
            ariaLabel="Categoria"
            placeholder="Selecione..."
            options={structureCategories.map((item) => ({
              value: item,
              label: item,
            }))}
          />
        </label>
        <label>
          Valor mensal
          <input
            inputMode="numeric"
            value={value ? money(value) : ""}
            onChange={(e) =>
              setValue(Number(e.target.value.replace(/\D/g, "")) / 100)
            }
            placeholder="R$ 0,00"
          />
        </label>
        <label>
          Como este custo deve ser distribuído?
          <CustomSelect
            value={allocationMode}
            onChange={(value) => setAllocationMode(value as "all" | "selected")}
            ariaLabel="Distribuição do custo"
            options={[
              { value: "all", label: "Todos os produtos" },
              { value: "selected", label: "Somente produtos que utilizam" },
            ]}
          />
          <small>
            {allocationMode === "selected"
              ? "Indicado para gás, água ou energia usados apenas por parte do cardápio."
              : "Indicado para aluguel, internet, contabilidade e despesas gerais."}
          </small>
        </label>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!description || !category || value <= 0}
            onClick={() =>
              save({
                id: `estrutura-${Date.now()}`,
                description,
                category,
                monthlyValue: value,
                recurrence: "monthly",
                allocationMode,
              })
            }
          >
            Salvar custo
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}
function ImprovedTeamDrawer({
  close,
  save,
}: {
  close: () => void;
  save: (row: TeamCost) => void;
}) {
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState(0);
  const [charges, setCharges] = useState(0);
  const [benefits, setBenefits] = useState(0);
  const [other, setOther] = useState(0);
  const [direct, setDirect] = useState(false);
  const [hours, setHours] = useState(0);
  const field = (
    label: React.ReactNode,
    value: number,
    setter: (value: number) => void,
  ) => (
    <label>
      {label}
      <input
        inputMode="numeric"
        value={value ? money(value) : ""}
        onChange={(e) =>
          setter(Number(e.target.value.replace(/\D/g, "")) / 100)
        }
        placeholder="R$ 0,00"
      />
    </label>
  );
  return (
    <SimpleDrawer title="Novo custo de equipe" close={close}>
      <div className="cost-form">
        <label>
          Nome ou função
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex.: Cozinheiro"
          />
        </label>
        {field("Salário", salary, setSalary)}
        <div className="cost-form-grid">
          {field(
            <span className="label-with-tooltip">
              Encargos{" "}
              <CostTooltip text="Custos adicionais pagos pela empresa além do salário, como tributos e encargos trabalhistas." />
            </span>,
            charges,
            setCharges,
          )}
          {field("Benefícios", benefits, setBenefits)}
        </div>
        {field("Outros custos", other, setOther)}
        <label className="settings-toggle">
          <span>
            Trabalha diretamente na produção?
            <small>
              Use para cozinheiros e funções cujo tempo entra no custo do
              produto.
            </small>
          </span>
          <input
            type="checkbox"
            checked={direct}
            onChange={() => setDirect(!direct)}
          />
        </label>
        {direct && (
          <label>
            Horas produtivas por mês
            <input
              inputMode="decimal"
              value={hours || ""}
              onChange={(e) =>
                setHours(Number(e.target.value.replace(",", ".")) || 0)
              }
              placeholder="Ex.: 160"
            />
          </label>
        )}
        <div className="calculated-cost team-result">
          <span>Custo empresa</span>
          <strong>{money(salary + charges + benefits + other)}</strong>
        </div>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!role || salary <= 0 || (direct && hours <= 0)}
            onClick={() =>
              save({
                id: `equipe-${Date.now()}`,
                role,
                salary,
                charges,
                benefits,
                otherCosts: other,
                directProduction: direct,
                productiveHoursMonthly: direct ? hours : 0,
              })
            }
          >
            Salvar custo
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}
function StructureDrawer({
  close,
  save,
}: {
  close: () => void;
  save: (row: StructureCost) => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState(0);
  return (
    <SimpleDrawer title="Novo custo de estrutura" close={close}>
      <div className="cost-form">
        <label>
          Descrição
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Aluguel"
          />
        </label>
        <label>
          Categoria
          <CustomSelect
            value={category}
            onChange={setCategory}
            ariaLabel="Categoria"
            placeholder="Selecione..."
            options={structureCategories.map((x) => ({ value: x, label: x }))}
          />
        </label>
        <label>
          Valor mensal
          <input
            value={value ? money(value) : ""}
            onChange={(e) =>
              setValue(Number(e.target.value.replace(/\D/g, "")) / 100)
            }
            placeholder="R$ 0,00"
          />
        </label>
        <label>
          Recorrência
          <CustomSelect
            value="monthly"
            onChange={() => {}}
            ariaLabel="Recorrência"
            options={[{ value: "monthly", label: "Mensal" }]}
          />
        </label>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!description || !category || value <= 0}
            onClick={() =>
              save({
                id: `estrutura-${Date.now()}`,
                description,
                category,
                monthlyValue: value,
                recurrence: "monthly",
              })
            }
          >
            Salvar custo
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}
function TeamDrawer({
  close,
  save,
}: {
  close: () => void;
  save: (row: TeamCost) => void;
}) {
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState(0);
  const [charges, setCharges] = useState(0);
  const [benefits, setBenefits] = useState(0);
  const [other, setOther] = useState(0);
  const field = (label: string, value: number, setter: (v: number) => void) => (
    <label>
      {label}
      <input
        value={value ? money(value) : ""}
        onChange={(e) =>
          setter(Number(e.target.value.replace(/\D/g, "")) / 100)
        }
        placeholder="R$ 0,00"
      />
    </label>
  );
  return (
    <SimpleDrawer title="Novo custo de equipe" close={close}>
      <div className="cost-form">
        <label>
          Nome ou função
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex.: Cozinheiro"
          />
        </label>
        {field("Salário", salary, setSalary)}
        <div className="cost-form-grid">
          {field("Encargos", charges, setCharges)}
          {field("Benefícios", benefits, setBenefits)}
        </div>
        {field("Outros custos", other, setOther)}
        <div className="calculated-cost">
          <span>Custo empresa</span>
          <strong>{money(salary + charges + benefits + other)}</strong>
        </div>
        <footer>
          <button className={buttonClass("ghost")} onClick={close}>
            Cancelar
          </button>
          <button
            className={buttonClass("primary")}
            disabled={!role || salary <= 0}
            onClick={() =>
              save({
                id: `equipe-${Date.now()}`,
                role,
                salary,
                charges,
                benefits,
                otherCosts: other,
              })
            }
          >
            Salvar custo
          </button>
        </footer>
      </div>
    </SimpleDrawer>
  );
}

type CostImportPreview = {
  name: string;
  type: CostItemType;
  category: string;
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnit: PurchaseUnit;
  packageContentQuantity?: number;
  packageContentUnit?: BasePurchaseUnit;
  supplierName: string;
  notes: string;
  row: number;
};
const normalizeImportValue = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
const parseSheetNumber = (value: unknown) =>
  typeof value === "number"
    ? value
    : Number(
        String(value ?? "")
          .trim()
          .replace(/\./g, "")
          .replace(",", "."),
      );

function ImportCostsDrawer({
  items,
  suppliers,
  close,
}: {
  items: CostItem[];
  suppliers: Supplier[];
  close: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<CostImportPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const review = async () => {
    if (!file || busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName =
        workbook.SheetNames.find(
          (name) => normalizeImportValue(name) === "insumos",
        ) ?? workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error("A planilha não possui uma aba de insumos.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      });
      const headerIndex = matrix.findIndex((row) =>
        row.some(
          (cell) =>
            normalizeImportValue(cell) === "nome do insumo" ||
            normalizeImportValue(cell) === "nome",
        ),
      );
      if (headerIndex < 0)
        throw new Error(
          "Não encontrei o cabeçalho da aba Insumos. Baixe novamente o modelo da NEQTA.",
        );
      const headers = matrix[headerIndex].map(normalizeImportValue);
      const col = (...names: string[]) =>
        headers.findIndex((header) => names.includes(header));
      const nameCol = col("nome do insumo", "nome");
      const typeCol = col("tipo");
      const categoryCol = col("categoria");
      const priceCol = col("preco da compra", "preco");
      const quantityCol = col("quantidade comprada", "quantidade");
      const unitCol = col("unidade da compra", "unidade");
      const contentQuantityCol = col(
        "conteudo por caixa/pacote",
        "conteudo por embalagem",
        "quantidade por caixa/pacote",
        "conteudo",
      );
      const contentUnitCol = col("unidade do conteudo", "unidade base");
      const supplierCol = col("fornecedor (opcional)", "fornecedor");
      const notesCol = col("observacao (opcional)", "observacao");
      const nextErrors: string[] = [];
      const nextRows = matrix
        .slice(headerIndex + 1)
        .flatMap<CostImportPreview>((row, index) => {
          const name = String(row[nameCol] ?? "").trim();
          const rawType = normalizeImportValue(row[typeCol]);
          const category = String(row[categoryCol] ?? "").trim();
          const purchasePrice =
            typeof row[priceCol] === "number"
              ? Number(row[priceCol])
              : parseBRL(String(row[priceCol] ?? ""));
          const purchaseQuantity = parseSheetNumber(row[quantityCol]);
          const unit = String(row[unitCol] ?? "").trim() as PurchaseUnit;
          const packageContentQuantity =
            contentQuantityCol >= 0
              ? parseSheetNumber(row[contentQuantityCol])
              : 0;
          const packageContentUnit =
            contentUnitCol >= 0
              ? (String(row[contentUnitCol] ?? "").trim() as BasePurchaseUnit)
              : undefined;
          const rowNumber = headerIndex + index + 2;
          if (
            !name &&
            !rawType &&
            !category &&
            !row[priceCol] &&
            !row[quantityCol] &&
            !unit
          )
            return [];
          const type: CostItemType =
            rawType === "embalagem" || rawType === "packaging"
              ? "packaging"
              : "ingredient";
          if (
            !name ||
            !category ||
            !["ingrediente", "ingredient", "embalagem", "packaging"].includes(
              rawType,
            ) ||
            !(purchasePrice > 0) ||
            !(purchaseQuantity > 0) ||
            !unitOptions.includes(unit)
          ) {
            nextErrors.push(
              `Linha ${rowNumber}: preencha nome, tipo, categoria, preço, quantidade e uma unidade válida.`,
            );
            return [];
          }
          const commercialPackage = unit === "cx" || unit === "pct";
          if (
            commercialPackage &&
            (!(packageContentQuantity > 0) ||
              !packageContentUnit ||
              !baseUnitOptions.includes(packageContentUnit))
          ) {
            nextErrors.push(
              `Linha ${rowNumber}: informe quanto existe em cada ${unit === "cx" ? "caixa" : "pacote"} e a unidade desse conteúdo.`,
            );
            return [];
          }
          return [
            {
              name,
              type,
              category,
              purchasePrice,
              purchaseQuantity,
              purchaseUnit: unit,
              packageContentQuantity: commercialPackage
                ? packageContentQuantity
                : undefined,
              packageContentUnit: commercialPackage
                ? packageContentUnit
                : undefined,
              supplierName: String(row[supplierCol] ?? "").trim(),
              notes: String(row[notesCol] ?? "").trim(),
              row: rowNumber,
            },
          ];
        });
      nextRows
        .filter(
          (entry, index) =>
            nextRows.findIndex(
              (candidate) =>
                normalizeImportValue(candidate.name) ===
                normalizeImportValue(entry.name),
            ) !== index,
        )
        .forEach((entry) =>
          nextErrors.push(
            `Linha ${entry.row}: o insumo ${entry.name} aparece mais de uma vez.`,
          ),
        );
      nextRows
        .filter((entry) =>
          items.some(
            (item) =>
              normalizeImportValue(item.name) ===
              normalizeImportValue(entry.name),
          ),
        )
        .forEach((entry) =>
          nextErrors.push(
            `Linha ${entry.row}: o insumo ${entry.name} já existe na NEQTA.`,
          ),
        );
      if (!nextRows.length && !nextErrors.length)
        nextErrors.push("Nenhum insumo preenchido foi encontrado.");
      setRows(nextRows);
      setErrors(nextErrors);
      setStep(2);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Não foi possível ler este arquivo.",
      ]);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };
  const importRows = async () => {
    if (!rows.length || errors.length || busy) return;
    setBusy(true);
    try {
      const knownSuppliers = new Map(
        suppliers.map((supplier) => [
          normalizeImportValue(supplier.name),
          supplier,
        ]),
      );
      for (const [index, row] of rows.entries()) {
        let supplierId: string | undefined;
        if (row.supplierName) {
          const key = normalizeImportValue(row.supplierName);
          let supplier = knownSuppliers.get(key);
          if (!supplier) {
            supplier = await supplierService.save({
              id: `fornecedor-importado-${Date.now()}-${index}`,
              name: row.supplierName,
              active: true,
            });
            knownSuppliers.set(key, supplier);
          }
          supplierId = supplier.id;
        }
        await costService.save({
          name: row.name,
          type: row.type,
          category: row.category,
          supplierId,
          purchasePrice: row.purchasePrice,
          purchaseQuantity: row.purchaseQuantity,
          purchaseUnit: row.purchaseUnit,
          packageContentQuantity: row.packageContentQuantity,
          packageContentUnit: row.packageContentUnit,
          notes: row.notes,
        });
      }
      setStep(3);
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Não foi possível importar os insumos.",
      ]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SimpleDrawer title="Importar insumos" close={close}>
      <div className="cost-import-shell">
        <div className="import-steps improved-import-steps">
          <span className={step === 1 ? "active" : ""}>
            <b>1</b>Arquivo
          </span>
          <span className={step === 2 ? "active" : ""}>
            <b>2</b>Revisão
          </span>
          <span className={step === 3 ? "active" : ""}>
            <b>3</b>Importação
          </span>
        </div>
        {step === 1 && (
          <>
            <section className="cost-import-template">
              <span>
                <Download />
              </span>
              <div>
                <h3>Comece pelo modelo da NEQTA</h3>
                <p>
                  Uma planilha simples, com instruções, listas prontas e cálculo
                  automático do custo unitário.
                </p>
              </div>
              <a
                className={buttonClass("secondary")}
                href="/modelos/modelo-importacao-insumos-neqta.xlsx"
                download="modelo-importacao-insumos-neqta.xlsx"
              >
                <Download />
                Baixar modelo XLSX
              </a>
            </section>
            <div className="import-or">
              <span>depois de preencher</span>
            </div>
            <label
              className={`file-drop cost-file-drop${file ? " has-file" : ""}`}
            >
              <FileUp />
              <b>
                {file
                  ? "Arquivo selecionado"
                  : "Arraste ou selecione sua planilha"}
              </b>
              <span>{file?.name ?? "Formatos aceitos: XLSX, XLS ou CSV"}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <div className="import-help">
              <b>Antes de continuar</b>
              <span>
                A NEQTA verificará campos obrigatórios e insumos duplicados
                antes de salvar.
              </span>
            </div>
            <div className="drawer-actions">
              <button className={buttonClass("ghost")} onClick={close}>
                Cancelar
              </button>
              <button
                className={buttonClass("primary")}
                disabled={!file || busy}
                onClick={review}
              >
                {busy ? "Lendo arquivo..." : "Revisar arquivo"}
                <ArrowRight />
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <section className="import-review-summary">
              <h3>
                {errors.length
                  ? "Revise os dados da planilha"
                  : `${rows.length} ${rows.length === 1 ? "insumo pronto" : "insumos prontos"} para importar`}
              </h3>
              <p>Nada foi salvo ainda.</p>
            </section>
            {errors.length > 0 && (
              <div className="import-review-errors" role="alert">
                {errors.map((error) => (
                  <p key={error}>
                    <Info />
                    {error}
                  </p>
                ))}
              </div>
            )}
            {rows.length > 0 && (
              <div className="cost-import-review">
                {rows.map((row) => (
                  <article key={`${row.row}-${row.name}`}>
                    <div>
                      <b>{row.name}</b>
                      <span>
                        {row.type === "ingredient"
                          ? "Ingrediente"
                          : "Embalagem"}{" "}
                        · {row.category} · {row.purchaseQuantity}{" "}
                        {row.purchaseUnit}
                      </span>
                    </div>
                    <strong>
                      {money(
                        calculateEffectiveUnitCost(
                          row.purchasePrice,
                          row.purchaseQuantity,
                          0,
                          0,
                          0,
                          row.packageContentQuantity ?? 1,
                        ),
                      )}
                      /{row.packageContentUnit ?? row.purchaseUnit}
                    </strong>
                  </article>
                ))}
              </div>
            )}
            <div className="drawer-actions">
              <button
                className={buttonClass("ghost")}
                onClick={() => {
                  setStep(1);
                  setErrors([]);
                }}
              >
                Voltar
              </button>
              <button
                className={buttonClass("primary")}
                disabled={!rows.length || Boolean(errors.length) || busy}
                onClick={importRows}
              >
                {busy ? "Importando..." : "Importar insumos"}
                <ArrowRight />
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <section className="import-success">
            <Check />
            <h3>Importação concluída</h3>
            <p>
              {rows.length}{" "}
              {rows.length === 1
                ? "insumo foi adicionado"
                : "insumos foram adicionados"}{" "}
              ao seu sistema NEQTA.
            </p>
            <button
              className={buttonClass("primary")}
              onClick={() => window.location.reload()}
            >
              Ver insumos
            </button>
          </section>
        )}
      </div>
    </SimpleDrawer>
  );
}

function SimpleDrawer({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);
  if (!mounted) return null;
  const drawerChildren = Children.toArray(children);
  const formIndex = drawerChildren.findIndex(
    (child) =>
      isValidElement<{ className?: string }>(child) &&
      child.props.className?.split(" ").includes("cost-form"),
  );
  const form =
    formIndex >= 0
      ? (drawerChildren[formIndex] as React.ReactElement<{
          className?: string;
          children?: React.ReactNode;
        }>)
      : null;
  const formChildren = form ? Children.toArray(form.props.children) : [];
  const footerIndex = formChildren.findIndex(
    (child) => isValidElement(child) && child.type === "footer",
  );
  const footer = footerIndex >= 0 ? formChildren[footerIndex] : null;
  const body =
    footer && form
      ? drawerChildren.map((child, index) =>
          index === formIndex
            ? cloneElement(form, {
                children: formChildren.filter(
                  (_, childIndex) => childIndex !== footerIndex,
                ),
              })
            : child,
        )
      : children;
  return createPortal(
    <div
      className="product-overlay costs-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className={`product-drawer cost-drawer${footer ? " has-fixed-footer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={close} aria-label="Fechar">
            <X />
          </button>
        </header>
        <div className="product-drawer-content">{body}</div>
        {footer &&
          cloneElement(footer as React.ReactElement<{ className?: string }>, {
            className: "cost-drawer-footer",
          })}
      </section>
    </div>,
    document.body,
  );
}
function TypeBadge({ type }: { type: CostItemType }) {
  return (
    <span className={`cost-type ${type}`}>
      {type === "ingredient" ? "Ingrediente" : "Embalagem"}
    </span>
  );
}
function Variation({ item }: { item?: CostItem }) {
  const value = item
    ? priceVariation(effectiveUnitCostForItem(item), item.previousUnitCost)
    : null;
  const state =
    value === null || value === 0
      ? "none"
      : value < 0
        ? "down"
        : value > COST_VARIATION_THRESHOLDS.critical
          ? "high"
          : value >= COST_VARIATION_THRESHOLDS.attention
            ? "moderate"
            : "neutral";
  return (
    <span className={`cost-variation ${state}`}>{variationLabel(value)}</span>
  );
}
