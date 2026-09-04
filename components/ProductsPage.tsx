'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, ArrowRight, Check, ChevronLeft, Download, FileUp, Info, Layers3, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { buildPricingCost, calculateMargin, formatPercent, marginForChannel, money, multiplyMoney, parseBRL, recommendedPriceForChannel, sumMoney } from '@/lib/financial';
import { componentCost, type Unit } from '@/lib/units';
import { productsService } from '@/services/products.service';
import { costService, effectiveUnitCostForItem, effectiveUnitForItem, structureCostService, teamCostService } from '@/services/costs.service';
import { routes } from '@/config/routes';
import { sanitizeDecimal } from '@/lib/input';
import { defaultSettings, loadSettingsFromSupabase } from '@/lib/settings';
import type { Product, ProductComponent, ProductOperationalCost, ProductPackaging, ProductStatus, ProductUtilityUsage } from '@/types/product';
import type { NeqtaSettings } from '@/types/settings';
import type { StructureCost } from '@/types/cost';

type View = 'products' | 'recipes';
type Filter = 'all' | 'healthy' | 'warning' | 'critical' | 'review';
type SortKey = 'name' | 'variableCost' | 'currentPrice' | 'projectedMargin';
type ComponentLine = Omit<ProductComponent, 'unit'> & { unit: Unit };
type PackagingLine = ProductPackaging;

const componentOptions: Array<Omit<ComponentLine, 'quantity'>> = [];
const packagingOptions = [
  { id: 'caixa-burger', name: 'Caixa burger', unitCost: 1.2 },
  { id: 'pote-500', name: 'Pote 500 ml', unitCost: 1.65 },
  { id: 'tampa', name: 'Tampa', unitCost: .42 },
  { id: 'papel', name: 'Papel anti-gordura', unitCost: .18 },
];

function costItemUnit(unit: import('@/types/cost').PurchaseUnit): Unit {
  if (unit === 'kg' || unit === 'g') return 'g';
  if (unit === 'L' || unit === 'ml') return 'ml';
  if (unit === 'pct') return 'pacote';
  return unit;
}

function resolvedCostItemUnit(item: import('@/types/cost').CostItem): Unit {
  return costItemUnit(effectiveUnitForItem(item) ?? item.purchaseUnit);
}

function normalizedComponentUnitCost(
  cost: number,
  unit: import('@/types/cost').PurchaseUnit,
): number {
  if (unit === 'g' || unit === 'ml') return cost * 1000;
  return cost;
}
type SalesChannel = { id: string; name: string; active: boolean; primary?: boolean; percentageFee?: number; fixedFee?: number; paymentHandledByChannel: boolean; feeConfigured: boolean };
function currencyFromInput(value: string) { return parseBRL(value); }
function decimalFromInput(value: string) { return sanitizeDecimal(value,3); }
function unusuallyHigh(quantity: number, unit: Unit) { return unit === 'g' || unit === 'ml' ? quantity > 10000 : unit === 'kg' || unit === 'L' ? quantity > 20 : quantity > 100; }

const filters: Array<[Filter, string]> = [['all', 'Todos'], ['healthy', 'Saudáveis'], ['warning', 'Atenção'], ['critical', 'Críticos']];
const statusLabel: Record<ProductStatus, string> = { healthy: 'Saudável', warning: 'Atenção', critical: 'Crítico', recipe: 'Receita-base' };

export function ProductsPage({ initialProducts, initialStatus, initialView }: { initialProducts: Product[]; initialStatus?: string; initialView?: string }) {
  const initialFilter: Filter = initialStatus === 'revisar' ? 'review' : filters.some(([key]) => key === initialStatus) ? initialStatus as Filter : 'all';
  const [products, setProducts] = useState(initialProducts);
  const [view, setView] = useState<View>(initialStatus === 'revisar' ? 'products' : initialView === 'receitas-base' ? 'recipes' : 'products');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [sort, setSort] = useState<SortKey>('name');
  const [ascending, setAscending] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [wizard, setWizard] = useState<Product | 'new' | null>(null);
  const [recipeWizard, setRecipeWizard] = useState<Product | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [pageToast, setPageToast] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelected(null); setImporting(false); setDeleting(null); setActionFor(null);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  useEffect(() => { if (!pageToast) return; const timer = window.setTimeout(() => setPageToast(''), 3000); return () => window.clearTimeout(timer); }, [pageToast]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return products
      .filter((product) => view === 'recipes' ? product.status === 'recipe' : product.status !== 'recipe')
      .filter((product) => !normalized || `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(normalized))
      .filter((product) => view === 'recipes' || filter === 'all' || (filter === 'review' ? product.status === 'critical' || product.status === 'warning' : product.status === filter))
      .sort((a, b) => {
        const difference = sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : a[sort] - b[sort];
        return ascending ? difference : -difference;
      });
  }, [products, query, filter, sort, ascending, view]);

  const finalProducts = products.filter((product) => product.status !== 'recipe');
  const counts = { critical: finalProducts.filter((p) => p.status === 'critical').length, warning: finalProducts.filter((p) => p.status === 'warning').length, healthy: finalProducts.filter((p) => p.status === 'healthy').length };
  function clearFilters() { setQuery(''); setFilter('all'); window.history.replaceState({}, '', routes.products); }
  function chooseFilter(next: Filter) { setView('products'); setFilter(next); const value = next === 'all' ? '' : `?status=${next}`; window.history.replaceState({}, '', `${routes.products}${value}`); }
  function chooseView(next: View) { setView(next); setQuery(''); setFilter('all'); setActionFor(null); window.history.replaceState({}, '', next === 'recipes' ? `${routes.products}?view=receitas-base` : routes.products); }
  function sortBy(next: SortKey) { if (sort === next) setAscending((value) => !value); else { setSort(next); setAscending(true); } }
  async function removeProduct() { if (!deleting) return; await productsService.remove(deleting.id); setProducts((current) => current.filter((item) => item.id !== deleting.id)); setDeleting(null); setSelected(null); }
  async function persistProduct(product: Product) {
    try {
      const saved = await productsService.save(product);
      setProducts((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setWizard(null);
      setPageToast('Produto salvo.');
    } catch (error) {
      setPageToast(error instanceof Error ? error.message : 'Não foi possível salvar o produto.');
    }
  }
  async function persistRecipe(recipe: Product) {
    try {
      const saved = await productsService.save(recipe);
      setProducts((current) => current.some((item) => item.id === saved.id)
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setRecipeWizard(null);
      setPageToast('Receita-base salva.');
    } catch (error) {
      setPageToast(error instanceof Error ? error.message : 'Não foi possível salvar a receita-base.');
    }
  }
  async function duplicate(product: Product) {
    const copy={ ...product, id: `${product.id}-copia-${Date.now()}`, name: `${product.name} — cópia` };
    try {
      const saved = await productsService.save(copy);
      setProducts((current) => [...current, saved]);
      setPageToast('Produto duplicado.');
    } catch (error) {
      setPageToast(error instanceof Error ? error.message : 'Não foi possível duplicar o produto.');
    }
    setActionFor(null);
  }

  return <div className="products-page">
    <section className="products-heading">
      <div><h1>Produtos</h1><p>{view === 'products' ? 'Gerencie os itens finais vendidos aos seus clientes.' : 'Gerencie preparos reutilizáveis usados na composição dos seus produtos.'}</p></div>
      <div className="products-heading-actions"><button className={buttonClass('secondary')} onClick={() => setImporting(true)}><FileUp />Importar</button><button className={buttonClass('primary')} onClick={() => view === 'products' ? setWizard('new') : setRecipeWizard('new')}><Plus />{view === 'products' ? 'Novo produto' : 'Nova receita-base'}</button></div>
    </section>

    <nav className="product-tabs" aria-label="Áreas de produtos">
      <button className={view === 'products' ? 'active' : ''} onClick={() => chooseView('products')}>Produtos</button>
      <button className={view === 'recipes' ? 'active' : ''} onClick={() => chooseView('recipes')}>Receitas-base</button>
    </nav>

    {view === 'products' && <section className="card product-xray"><div><h2>Raio-X dos Produtos</h2><p>Visão rápida da saúde dos itens finais vendidos.</p></div><div className="xray-states"><button onClick={() => chooseFilter('critical')}><b className="danger">{counts.critical}</b><span>Críticos</span></button><button onClick={() => chooseFilter('warning')}><b className="warning">{counts.warning}</b><span>Atenção</span></button><button onClick={() => chooseFilter('healthy')}><b className="success">{counts.healthy}</b><span>Saudáveis</span></button></div></section>}

    {view === 'products' && filter === 'review' && <div className="review-banner"><span><b>Produtos para revisar</b> · críticos e em atenção</span><button onClick={clearFilters}>Limpar filtro</button></div>}

    <section className="product-toolbar">
      <label className="product-search"><Search /><span className="sr-only">{view === 'products' ? 'Buscar produto' : 'Buscar receita-base'}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'products' ? 'Buscar produto...' : 'Buscar receita-base...'} /></label>
      {view === 'products' && <div className="filter-scroll" aria-label="Filtros de produtos">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => chooseFilter(key)}>{label}</button>)}</div>}
    </section>

    {visible.length === 0 ? <section className="card product-empty"><h2>{view === 'products' ? 'Nenhum produto encontrado.' : 'Nenhuma receita-base encontrada.'}</h2><p>Revise a busca ou os filtros aplicados.</p><button className={buttonClass('secondary')} onClick={clearFilters}>Limpar busca</button></section> : view === 'products' ? <>
      <ProductTable products={visible} actionFor={actionFor} setActionFor={setActionFor} select={setSelected} edit={setWizard} duplicate={duplicate} remove={setDeleting} sortBy={sortBy} />
      <ProductCards products={visible} select={setSelected} />
    </> : <>
      <RecipeTable products={visible} actionFor={actionFor} setActionFor={setActionFor} select={setSelected} edit={setRecipeWizard} duplicate={duplicate} remove={setDeleting} />
      <RecipeCards products={visible} select={setSelected} />
    </>}

    {selected && <ProductDetails product={selected} close={() => setSelected(null)} edit={() => { setWizard(selected); setSelected(null); }} remove={() => setDeleting(selected)} />}
    {wizard && <ProductWizard product={wizard === 'new' ? null : wizard} close={() => setWizard(null)} save={(product) => { void persistProduct(product); }} />}
    {recipeWizard && <RecipeWizard recipe={recipeWizard === 'new' ? null : recipeWizard} close={() => setRecipeWizard(null)} save={persistRecipe} />}
    {importing && <ImportDrawer close={() => setImporting(false)} />}
    {deleting && <ConfirmDelete product={deleting} close={() => setDeleting(null)} confirm={removeProduct} />}
    {pageToast && <Toast message={pageToast} close={() => setPageToast('')} />}
  </div>;
}

function ProductTable({ products, actionFor, setActionFor, select, edit, duplicate, remove, sortBy }: { products: Product[]; actionFor: string | null; setActionFor: (id: string | null) => void; select: (product: Product) => void; edit: (product: Product) => void; duplicate: (product: Product) => void; remove: (product: Product) => void; sortBy: (key: SortKey) => void }) {
  return <section className="card products-table-wrap"><table className="products-table"><thead><tr><Sortable label="Produto" value="name" onClick={sortBy} /><th>Categoria</th><Sortable label="Custo variável" value="variableCost" onClick={sortBy} /><Sortable label="Preço atual" value="currentPrice" onClick={sortBy} /><Sortable label="Margem projetada" value="projectedMargin" onClick={sortBy} /><th>Status</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{products.map((product) => <tr key={product.id} onClick={() => select(product)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && select(product)}><td><b>{product.name}</b></td><td>{product.category}</td><td>{money(product.variableCost)}</td><td>{money(product.currentPrice)}{product.recommendedPrice > product.currentPrice && <small className="recommended-note">Recomendado: {money(product.recommendedPrice)}</small>}</td><td title="Margem projetada com base nos custos e taxas cadastrados.">{product.projectedMargin.toFixed(1)}%</td><td><StatusBadge status={product.status} /></td><ActionCell product={product} actionFor={actionFor} setActionFor={setActionFor} select={select} edit={edit} duplicate={duplicate} remove={remove} /></tr>)}</tbody></table></section>;
}

function RecipeTable({ products, actionFor, setActionFor, select, edit, duplicate, remove }: { products: Product[]; actionFor: string | null; setActionFor: (id: string | null) => void; select: (product: Product) => void; edit: (product: Product) => void; duplicate: (product: Product) => void; remove: (product: Product) => void }) {
  return <section className="card products-table-wrap"><table className="products-table recipe-table"><thead><tr><th>Receita</th><th>Rendimento</th><th>Unidade</th><th>Custo total</th><th>Custo por unidade</th><th>Componentes</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{products.map((recipe) => <tr key={recipe.id} onClick={() => select(recipe)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && select(recipe)}><td><b><Layers3 />{recipe.name}</b></td><td>{recipe.yieldQuantity ?? '—'} {recipe.yieldUnit}</td><td>{recipe.yieldUnit ?? '—'}</td><td>{money(recipe.variableCost)}</td><td>{money(recipe.unitCost ?? 0)}/{recipe.yieldUnit}</td><td>{recipe.componentCount ?? 0} componentes</td><ActionCell product={recipe} actionFor={actionFor} setActionFor={setActionFor} select={select} edit={edit} duplicate={duplicate} remove={remove} /></tr>)}</tbody></table></section>;
}

function ActionCell({ product, actionFor, setActionFor, select, edit, duplicate, remove }: { product: Product; actionFor: string | null; setActionFor: (id: string | null) => void; select: (product: Product) => void; edit: (product: Product) => void; duplicate: (product: Product) => void; remove: (product: Product) => void }) {
  return <td className="row-actions"><button aria-label={`Ações de ${product.name}`} onClick={(event) => { event.stopPropagation(); setActionFor(actionFor === product.id ? null : product.id); }}><MoreHorizontal /></button>{actionFor === product.id && <ActionMenu product={product} close={() => setActionFor(null)} details={() => select(product)} edit={() => edit(product)} duplicate={() => duplicate(product)} remove={() => remove(product)} />}</td>;
}

function ProductCards({ products, select }: { products: Product[]; select: (product: Product) => void }) {
  return <section className="product-cards">{products.map((product) => <article className="card product-card" key={product.id} onClick={() => select(product)}><div className="product-card-head"><div><h2>{product.name}</h2><p>{product.category}</p></div><StatusBadge status={product.status} /></div><div className="product-numbers"><span>Custo variável<b>{money(product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span></div><div className="product-margin"><span>Margem projetada</span><b>{product.projectedMargin.toFixed(1)}%</b></div>{product.recommendedPrice > product.currentPrice && <div className="mobile-recommended"><span>Recomendado</span><b>{money(product.recommendedPrice)}</b></div>}<button className="action-row"><span className="action-row-label">Ver produto</span><span className="action-row-icon"><ArrowRight /></span></button></article>)}</section>;
}

function RecipeCards({ products, select }: { products: Product[]; select: (product: Product) => void }) {
  return <section className="product-cards">{products.map((recipe) => <article className="card product-card recipe-card" key={recipe.id} onClick={() => select(recipe)}><div className="product-card-head"><div><h2><Layers3 />{recipe.name}</h2><p>Preparo reutilizável</p></div></div><div className="recipe-mobile-grid"><span>Rendimento<b>{recipe.yieldQuantity} {recipe.yieldUnit}</b></span><span>Custo total<b>{money(recipe.variableCost)}</b></span><span>Custo unitário<b>{money(recipe.unitCost ?? 0)}/{recipe.yieldUnit}</b></span></div><p className="recipe-components">{recipe.componentCount ?? 0} componentes</p><button className="action-row"><span className="action-row-label">Ver receita</span><span className="action-row-icon"><ArrowRight /></span></button></article>)}</section>;
}

function Sortable({ label, value, onClick }: { label: string; value: SortKey; onClick: (value: SortKey) => void }) { return <th><button onClick={() => onClick(value)}>{label}<ArrowDownUp /></button></th>; }
function StatusBadge({ status }: { status: ProductStatus }) { return <span className={`status-badge ${status}`}>{status === 'recipe' && <Layers3 />}{statusLabel[status]}</span>; }

function ActionMenu({ product, close, details, edit, duplicate, remove }: { product: Product; close: () => void; details: () => void; edit: () => void; duplicate: () => void; remove: () => void }) {
  return <div className="action-menu" onClick={(event) => event.stopPropagation()}><button onClick={details}>Ver detalhes</button><button onClick={edit}>Editar</button>{product.status !== 'recipe' && <Link href={routes.pricingProduct(product.id)} onClick={close}>Simular preço</Link>}<button onClick={duplicate}>Duplicar</button><button className="danger-action" onClick={remove}>Excluir</button></div>;
}

function ProductDetails({ product, close, edit, remove }: { product: Product; close: () => void; edit: () => void; remove: () => void }) {
  const recipe = product.status === 'recipe';
  return <Overlay title={recipe ? 'Detalhes da receita-base' : 'Detalhes do produto'} close={close}><div className="details-title"><div><h2>{product.name}</h2><p>{recipe ? 'Preparo reutilizável' : product.category}</p></div><StatusBadge status={product.status} /></div>{product.status === 'critical' && <div className="critical-alert"><b>Margem abaixo do limite configurado.</b><Link href={routes.pricingProduct(product.id)}>Simular ajuste</Link></div>}<div className="details-grid">{recipe ? <><span>Rendimento<b>{product.yieldQuantity} {product.yieldUnit}</b></span><span>Custo total<b>{money(product.variableCost)}</b></span><span>Custo por unidade<b>{money(product.unitCost ?? 0)}/{product.yieldUnit}</b></span><span>Componentes<b>{product.componentCount ?? 0}</b></span></> : <><span>Custo variável<b>{money(product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span><span>Margem projetada<b>{product.projectedMargin}%</b></span><span>Preço recomendado<b>{money(product.recommendedPrice)}</b></span></>}</div><section className="details-section"><h3>Composição</h3><p>Componentes e quantidades usados na ficha técnica.</p></section>{!recipe && <section className="details-section"><h3>Embalagem</h3><p>Itens diretamente atribuídos ao produto.</p></section>}<section className="details-section"><h3>Últimas alterações</h3><p>Composição revisada recentemente.</p></section><div className="drawer-actions"><button className={buttonClass('ghost')} onClick={remove}><Trash2 />Excluir</button><button className={buttonClass('secondary')} onClick={edit}>Editar</button>{!recipe && <Link className={buttonClass('primary')} href={routes.pricingProduct(product.id)}>Simular preço</Link>}</div></Overlay>;
}

function ProductWizard({ product, close, save }: { product: Product | null; close: () => void; save: (product: Product) => void }) {
  const initialComponent: Omit<ComponentLine, 'quantity'> = { id: '', name: '', type: 'INSUMO', unit: 'g' as Unit, unitCost: 0 };
  const initialPackaging: PackagingLine = { id: '', name: '', quantity: 0, unitCost: 0 };
  const [step, setStep] = useState(1);
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category || 'Lanches');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.currentPrice ?? 0);
  const [laborMinutes,setLaborMinutes]=useState(product?.laborMinutes??0);
  const [operationalCosts,setOperationalCosts]=useState<ProductOperationalCost[]>([{
    kind:'consumables',name:'Perdas e pequenos consumíveis',amount:product?.operationalCosts?.reduce((total,item)=>total+item.amount,0)??product?.directOperationalCost??0,
  }]);
  const [directLaborHourlyCost,setDirectLaborHourlyCost]=useState(0);
  const [monthlyOverhead,setMonthlyOverhead]=useState(0);
  const [structureCosts,setStructureCosts]=useState<StructureCost[]>([]);
  const [selectiveCosts,setSelectiveCosts]=useState<StructureCost[]>([]);
  const [indirectTeamMonthly,setIndirectTeamMonthly]=useState(0);
  const [utilityUsages,setUtilityUsages]=useState<ProductUtilityUsage[]>(product?.utilityUsages??[]);
  const [pricingSettings,setPricingSettings]=useState<NeqtaSettings>(defaultSettings);
  const target = pricingSettings.financial.targetMargin;
  const [components, setComponents] = useState<ComponentLine[]>((product?.components ?? []) as ComponentLine[]);
  const [availableComponents, setAvailableComponents] = useState<Array<Omit<ComponentLine, 'quantity'>>>(componentOptions);
  const [component, setComponent] = useState<ComponentLine>({ ...initialComponent, quantity: 0 });
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackagingLine[]>(product?.packaging ?? []);
  const [availablePackaging, setAvailablePackaging] = useState(packagingOptions);
  const [packaging, setPackaging] = useState<PackagingLine>(initialPackaging);
  const [editingPackaging, setEditingPackaging] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(()=>{void loadSettingsFromSupabase().then(setPricingSettings);const sync=(event:Event)=>setPricingSettings((event as CustomEvent<NeqtaSettings>).detail);window.addEventListener('neqta-settings-updated',sync);return()=>window.removeEventListener('neqta-settings-updated',sync)},[]);

  useEffect(() => {
    void Promise.all([costService.list(), productsService.list(),teamCostService.list(),structureCostService.list()]).then(([items, savedProducts,team,structure]) => {
      const productiveTeam=team.filter(item=>item.directProduction&&item.productiveHoursMonthly);const productivePayroll=productiveTeam.reduce((total,item)=>total+item.salary+item.charges+item.benefits+item.otherCosts,0);const productiveHours=productiveTeam.reduce((total,item)=>total+(item.productiveHoursMonthly??0),0);setDirectLaborHourlyCost(productiveHours>0?productivePayroll/productiveHours:0);
      const indirectTeam=team.filter(item=>!item.directProduction).reduce((total,item)=>total+item.salary+item.charges+item.benefits+item.otherCosts,0);setStructureCosts(structure.filter(item=>(item.allocationMode??'all')==='all'));setSelectiveCosts(structure.filter(item=>item.allocationMode==='selected'));setIndirectTeamMonthly(indirectTeam);setMonthlyOverhead(structure.filter(item=>(item.allocationMode??'all')==='all').reduce((total,item)=>total+item.monthlyValue,0)+indirectTeam);
      const ingredientComponents: Array<Omit<ComponentLine, 'quantity'>> = items
        .filter((item) => item.type === 'ingredient')
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: 'INSUMO',
          unit: resolvedCostItemUnit(item),
          unitCost: normalizedComponentUnitCost(effectiveUnitCostForItem(item), effectiveUnitForItem(item) ?? item.purchaseUnit),
        }));
      const recipeComponents: Array<Omit<ComponentLine, 'quantity'>> = savedProducts
        .filter((item) => item.status === 'recipe' && item.id !== product?.id)
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: 'RECEITA-BASE',
          unit: (item.yieldUnit as Unit) || 'kg',
          unitCost: item.unitCost ?? 0,
        }));
      setAvailableComponents(() => [
        ...ingredientComponents,
        ...recipeComponents,
      ]);
      const nextPackaging = items
        .filter((item) => item.type === 'packaging')
        .map((item) => ({ id: item.id, name: item.name, unitCost: effectiveUnitCostForItem(item) }));
      packagingOptions.splice(0, packagingOptions.length, ...nextPackaging);
      setAvailablePackaging(nextPackaging);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar insumos e receitas-base.'));
  }, [product?.id]);

  const componentsCost = sumMoney(components.map((item) => componentCost(item.quantity, item.unit, item.unitCost)));
  const packagingCost = sumMoney(packages.map((item) => multiplyMoney(item.quantity, item.unitCost)));
  const baseCost = sumMoney([componentsCost, packagingCost]);
  const operationalTotal=sumMoney(operationalCosts.map(item=>item.amount));
  const intensityWeight={low:.5,medium:1,high:1.5} as const;
  const selectedUtilityMonthly=utilityUsages.reduce((total,usage)=>total+(selectiveCosts.find(item=>item.id===usage.costId)?.monthlyValue??0)*intensityWeight[usage.intensity],0);
  const costModel=buildPricingCost({directCost:baseCost,directOperationalCost:operationalTotal,laborMinutes,directLaborHourlyCost,monthlyOverhead:monthlyOverhead+selectedUtilityMonthly,estimatedMonthlyRevenue:pricingSettings.financial.estimatedMonthlyRevenue});
  const totalCost = costModel.unitCost;
  const margin = calculateMargin(price, totalCost);
  const salesChannels:SalesChannel[]=pricingSettings.channels.map((channel,index)=>({id:channel.id,name:channel.name,active:channel.active,primary:channel.id==='store'||index===0,percentageFee:channel.percentageFee+pricingSettings.financial.salesTax+pricingSettings.financial.operationalReserve+costModel.overheadRate,fixedFee:channel.fixedFee,paymentHandledByChannel:channel.processesPayment,feeConfigured:true}));
  const paymentMethods=pricingSettings.payments.filter(method=>method.active).map(method=>({...method,percentageFee:method.percentageFee+method.anticipationFee+pricingSettings.financial.salesTax}));
  const channelPrices = salesChannels.filter((channel) => channel.active).map((channel) => ({ ...channel, recommended: channel.feeConfigured ? recommendedPriceForChannel(totalCost, target, channel.percentageFee, channel.fixedFee) : null, currentMargin: channel.feeConfigured ? marginForChannel(price, totalCost, channel.percentageFee, channel.fixedFee) : null }));
  const paymentPrices = paymentMethods.map((method) => ({ ...method, recommended: recommendedPriceForChannel(totalCost, target, method.percentageFee, method.fixedFee) }));
  const primaryRecommended = channelPrices.find((channel) => channel.primary)?.recommended ?? channelPrices[0]?.recommended ?? totalCost;
  const dirty = name !== (product?.name ?? '') || category !== (product?.category ?? 'Lanches') || description !== '' || price !== (product?.currentPrice ?? 0) || components.length > 0 || packages.length > 0;

  function requestClose() { if (dirty) setDiscarding(true); else close(); }
  function resetComponent() { setComponent({ ...initialComponent, quantity: 0 }); setEditingComponent(null); setError(''); }
  function selectComponent(id: string) { const option = availableComponents.find((item) => item.id === id) ?? initialComponent; setComponent({ ...option, quantity: component.quantity }); setError(''); }
  async function saveCreatedRecipe(recipe: Product) {
    const saved = await productsService.save(recipe);
    const recipeOption: Omit<ComponentLine, 'quantity'> = { id: saved.id, name: saved.name, type: 'RECEITA-BASE', unit: (saved.yieldUnit as Unit) || 'kg', unitCost: saved.unitCost ?? 0 };
    setAvailableComponents((current) => [...current.filter((item) => item.id !== recipeOption.id), recipeOption]);
    setComponent({ ...recipeOption, quantity: 0 });
    setCreatingRecipe(false);
    setToast('Receita-base criada.');
  }
  function addComponent() {
    if (!component.id) return setError('Selecione um insumo ou receita-base.');
    if (component.quantity <= 0) return setError('Informe uma quantidade maior que zero.');
    const wasEditingComponent = Boolean(editingComponent);
    if (!wasEditingComponent && components.some((item) => item.id === component.id && item.unit === component.unit)) {
      return setError('Este item já está na composição. Edite a quantidade existente ou cancele.');
    }
    setComponents((current) => {
      if (editingComponent) return current.map((item) => item.id === editingComponent ? component : item);
      const existing = current.find((item) => item.id === component.id && item.unit === component.unit);
      return existing ? current.map((item) => item.id === component.id ? { ...item, quantity: item.quantity + component.quantity } : item) : [...current, component];
    });
    resetComponent();
    setToast(wasEditingComponent ? 'Componente atualizado.' : 'Componente adicionado.');
  }
  function editComponent(item: ComponentLine) { setComponent(item); setEditingComponent(item.id); setError(''); }
  function removeComponent(id: string) { setComponents((current) => current.filter((item) => item.id !== id)); if (editingComponent === id) resetComponent(); }
  function resetPackaging() { setPackaging({ ...initialPackaging, quantity: 0 }); setEditingPackaging(null); setError(''); }
  function selectPackaging(id: string) { const option = availablePackaging.find((item) => item.id === id) ?? initialPackaging; setPackaging({ ...option, quantity: packaging.quantity }); setError(''); }
  function addPackaging() {
    if (!packaging.id) return setError('Selecione uma embalagem.');
    if (packaging.quantity <= 0) return setError('Informe uma quantidade de embalagem maior que zero.');
    const wasEditingPackaging = Boolean(editingPackaging);
    if (!wasEditingPackaging && packages.some((item) => item.id === packaging.id)) {
      return setError('Esta embalagem já está na composição. Edite a quantidade existente ou cancele.');
    }
    setPackages((current) => {
      if (editingPackaging) return current.map((item) => item.id === editingPackaging ? packaging : item);
      const existing = current.find((item) => item.id === packaging.id);
      return existing ? current.map((item) => item.id === packaging.id ? { ...item, quantity: item.quantity + packaging.quantity } : item) : [...current, packaging];
    });
    resetPackaging();
    setToast(wasEditingPackaging ? 'Embalagem atualizada.' : 'Embalagem adicionada.');
  }
  function editPackaging(item: PackagingLine) { setPackaging(item); setEditingPackaging(item.id); setError(''); }
  function removePackaging(id: string) { setPackages((current) => current.filter((item) => item.id !== id)); if (editingPackaging === id) resetPackaging(); }
  function canContinue() { if (step === 1) return Boolean(name.trim() && category && price >= 0); if (step === 2) return components.length > 0; return true; }
  function next() { if (!canContinue()) { setError(step === 1 ? 'Informe o nome e a categoria do produto.' : 'Adicione pelo menos um componente.'); return; } setError(''); setStep((current) => Math.min(4, current + 1)); }
  function submit() { save({ id: product?.id ?? `produto-${Date.now()}`, name: name.trim(), category, description: description.trim(), components, packaging: packages, kind: 'product', variableCost: baseCost, laborMinutes, directOperationalCost:operationalTotal, operationalCosts, utilityUsages, currentPrice: price, projectedMargin: baseCost > 0 ? margin : 0, targetMargin: target, recommendedPrice: primaryRecommended ?? totalCost, status: baseCost <= 0 || price <= 0 || margin < target - 8 ? 'critical' : margin < target ? 'warning' : 'healthy' }); }

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);
  if (creatingRecipe) return <RecipeWizard recipe={null} close={() => setCreatingRecipe(false)} save={saveCreatedRecipe} />;
  return <Overlay title={product ? 'Editar produto' : 'Novo produto'} close={requestClose} wide><div className="wizard-inner">
    <div className="wizard-progress">{['Informações', 'Composição', 'Embalagem', 'Resumo'].map((label, index) => { const number = index + 1; const complete = number < step; return <button type="button" disabled={number > step} className={number === step ? 'active current' : complete ? 'active complete' : ''} onClick={() => complete && setStep(number)} key={label}><b>{complete ? <Check /> : number}</b><span>{label}</span></button>; })}</div>
    {step === 1 && <div className="form-grid wizard-form"><label>Nome do produto<input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ex.: X-Bacon" /></label><label>Categoria<CustomSelect value={category} onChange={setCategory} ariaLabel="Categoria" options={['Lanches', 'Acompanhamentos', 'Bebidas', 'Combos'].map((label) => ({ value: label, label }))} /><small className="field-help">Use categorias para organizar sua lista de produtos.</small></label><label><LabelWithInfo label="Preço atual" text="Quanto você cobra por este produto hoje. Se ainda não vende este item, pode deixar em branco." /><input aria-label="Preço atual" type="text" inputMode="decimal" value={price > 0 ? money(price) : ''} placeholder="R$ 0,00" onChange={(event) => setPrice(currencyFromInput(event.target.value))} /></label><div className="company-margin"><LabelWithInfo label="Meta de margem da empresa" text="É a meta padrão definida nas configurações da empresa. Ela é usada como referência para os preços recomendados." /><b>{formatPercent(target)}</b><small>Aplicada automaticamente pela NEQTA.</small></div><label className="full">Descrição <small>Opcional</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Hambúrguer artesanal com bacon, queijo e molho da casa." /></label></div>}
    {step === 2 && <div className="wizard-stage guided-builder"><header className="stage-heading"><h3>Composição</h3><p>Adicione tudo o que é usado para produzir uma unidade deste produto.</p></header><p className="stage-note"><Info />Você pode usar ingredientes comprados ou preparos que já deixou cadastrados.</p><section className="builder-surface"><h4>Adicionar à composição</h4><div className="builder-main-field"><span className="picker-label">Ingrediente ou preparo</span><ComponentPicker items={availableComponents} selected={component.id} select={selectComponent} /></div><div className="builder-input-row"><label>Quantidade<input type="text" inputMode="decimal" value={component.quantity ? String(component.quantity).replace('.', ',') : ''} onChange={(event) => setComponent({ ...component, quantity: decimalFromInput(event.target.value) })} placeholder="0" /></label><label>Unidade<CustomSelect value={component.unit} onChange={(value) => setComponent({ ...component, unit: value as Unit })} ariaLabel="Unidade" options={['g', 'kg', 'ml', 'L', 'un', 'cx', 'pacote', 'dúzia'].map((unit) => ({ value: unit, label: unit }))} /></label></div>{component.id && <div className="builder-results"><span><small>Custo de referência</small><b>{money(component.unitCost)}/{component.unit === 'g' ? 'kg' : component.unit === 'ml' ? 'L' : component.unit}</b></span><span><LabelWithInfo label="Custo neste produto" text="Calculado automaticamente a partir da quantidade utilizada e do custo cadastrado." /><b>{money(componentCost(component.quantity, component.unit, component.unitCost))}</b></span></div>}{component.id && unusuallyHigh(component.quantity, component.unit) && <p className="quantity-warning"><Info />Essa quantidade parece muito alta para uma unidade do produto. Confira antes de continuar.</p>}<div className="builder-actions"><button type="button" className="builder-add" disabled={!component.id || component.quantity <= 0 || !component.unit} onClick={addComponent}><Plus />{editingComponent ? 'Salvar alteração' : 'Adicionar à composição'}</button></div></section><aside className="recipe-context"><div><b>Não encontrou um preparo que você produz?</b><small>Ex.: molho da casa, maionese especial ou carne temperada.</small></div><button type="button" onClick={() => setCreatingRecipe(true)}><Plus />Criar receita-base</button></aside><section className="added-section"><h4>Componentes adicionados</h4>{components.length > 0 ? <div className="builder-list premium-list">{components.map((item) => <article key={item.id}><div><b>{item.name}{item.type === 'RECEITA-BASE' && <em className="recipe-badge"><Layers3 />Receita</em>}</b><span>{String(item.quantity).replace('.', ',')} {item.unit} × {money(item.unitCost)}/{item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}</span></div><div className="list-cost"><small>Custo no produto</small><strong>{money(componentCost(item.quantity, item.unit, item.unitCost))}</strong></div><div className="list-actions"><button type="button" aria-label={`Editar ${item.name}`} onClick={() => editComponent(item)}><Pencil />Editar</button><button type="button" aria-label={`Remover ${item.name}`} onClick={() => removeComponent(item.id)}><X /></button></div></article>)}</div> : <p className="builder-empty-line">Nenhum item adicionado à composição.</p>}<div className="builder-total"><span>Custo dos componentes</span><strong>{money(componentsCost)}</strong></div></section><p className="ingredient-link">Não encontrou um ingrediente comprado? <Link href={`${routes.costs}?tab=insumos`}>Ir para Custos &gt; Insumos <ArrowRight /></Link></p></div>}
    {step === 3 && <div className="wizard-stage guided-builder"><header className="stage-heading"><h3>Embalagem</h3><p>Adicione as embalagens utilizadas exclusivamente para vender uma unidade deste produto.</p></header><section className="builder-surface"><h4>Adicionar embalagem</h4><label className="builder-main-field">Embalagem<CustomSelect value={packaging.id} onChange={selectPackaging} ariaLabel="Embalagem" placeholder="Selecione uma embalagem..." options={packagingOptions.map((item) => ({ value: item.id, label: item.name }))} /></label><div className="builder-input-row single"><label>Quantidade<input type="text" inputMode="decimal" value={packaging.quantity ? String(packaging.quantity).replace('.', ',') : ''} onChange={(event) => setPackaging({ ...packaging, quantity: decimalFromInput(event.target.value) })} placeholder="0" /></label></div>{packaging.id && <div className="builder-results"><span><small>Custo unitário</small><b>{money(packaging.unitCost)}</b></span><span><small>Total da seleção</small><b>{money(multiplyMoney(packaging.quantity, packaging.unitCost))}</b></span></div>}<div className="builder-actions"><button type="button" className="builder-add" disabled={!packaging.id || packaging.quantity <= 0} onClick={addPackaging}><Plus />{editingPackaging ? 'Salvar alteração' : 'Adicionar embalagem'}</button></div></section><section className="added-section"><h4>Embalagens adicionadas</h4>{packages.length ? <div className="builder-list premium-list">{packages.map((item) => <article key={item.id}><div><b>{item.name}</b><span>{String(item.quantity).replace('.', ',')} {item.quantity === 1 ? 'unidade' : 'unidades'}</span></div><div className="list-cost"><small>Custo</small><strong>{money(multiplyMoney(item.quantity, item.unitCost))}</strong></div><div className="list-actions"><button type="button" aria-label={`Editar ${item.name}`} onClick={() => editPackaging(item)}><Pencil />Editar</button><button type="button" aria-label={`Remover ${item.name}`} onClick={() => removePackaging(item.id)}><X /></button></div></article>)}</div> : <div className="builder-empty-light"><b>Nenhuma embalagem adicionada.</b><span>Este produto não usa embalagem própria? Você pode continuar sem adicionar nenhuma.</span></div>}<div className="builder-total"><span>Custo das embalagens</span><strong>{money(packagingCost)}</strong></div></section><p className="context-note"><Info />Sacolas, lacres e itens usados no pedido inteiro são configurados separadamente.</p></div>}
    {step === 4 && <div className="wizard-summary premium-summary"><div className="summary-foundation"><section className="cost-ledger"><h3>Custo do produto</h3><div><span>Componentes</span><b>{money(componentsCost)}</b></div><div><span>Embalagens</span><b>{money(packagingCost)}</b></div><div className="cost-total"><span>Custo variável total</span><strong>{money(totalCost)}</strong></div></section><section className="margin-references"><h3>Referências</h3><div><LabelWithInfo label="Meta da empresa" text="É a meta padrão definida nas configurações da empresa." /><b>{formatPercent(target)}</b></div><div><span><LabelWithInfo label="Margem mínima NEQTA" text="Estimativa baseada na estrutura e nas projeções cadastradas." /></span><b>{formatPercent(pricingSettings.financial.minimumMargin)}</b></div><div className="current-price-line"><span>Preço praticado hoje</span><strong>{price > 0 ? money(price) : 'Não informado'}</strong></div></section></div><section className="channel-comparison"><header><h3><LabelWithInfo label="Preços recomendados" text="Cada canal possui taxas diferentes. A NEQTA calcula um preço recomendado para preservar sua meta em cada cenário." /></h3><p>Calculados de acordo com as taxas configuradas em cada canal.</p></header><div className="channel-rows">{channelPrices.map((channel) => channel.feeConfigured ? <button type="button" className={channel.primary ? 'channel-row primary-channel' : 'channel-row'} key={channel.id} onClick={() => channel.id === 'store' && setShowPayments(true)}><span className="channel-name"><b>{channel.name}</b>{channel.primary && <em>Principal</em>}</span><span className="channel-fee">{channel.percentageFee ? `Taxas ${formatPercent(channel.percentageFee)}` : 'Sem taxa'}</span><strong>{money(channel.recommended ?? 0)}</strong><span className="channel-meta">Meta {formatPercent(target)}</span><ArrowRight /></button> : <Link className="channel-row" key={channel.id} href={routes.settings}><span className="channel-name"><b>{channel.name}</b></span><span className="channel-fee">Taxa não configurada</span><strong>—</strong><span className="channel-meta">Configurar</span><ArrowRight /></Link>)}</div></section>{showPayments && <div className="payment-layer" role="presentation" onMouseDown={() => setShowPayments(false)}><section role="dialog" aria-modal="true" aria-label="Preços por forma de pagamento" onMouseDown={(event) => event.stopPropagation()}><header><div><h3>Loja por forma de pagamento</h3><p>As taxas abaixo são aplicadas somente à venda direta.</p></div><button type="button" aria-label="Fechar" onClick={() => setShowPayments(false)}><X /></button></header>{paymentPrices.map((method) => <article key={method.id}><div><b>{method.name}</b><small>Taxa: {formatPercent(method.percentageFee)}</small></div><div><small>Preço sugerido</small><strong>{money(method.recommended)}</strong></div></article>)}</section></div>}</div>}
    {step === 3 && <section className="builder-surface operational-costs"><h4>Custos considerados pela NEQTA</h4><p className="form-microcopy">Confira o que já entra automaticamente e preencha apenas os dados específicos deste produto.</p><div className="automatic-cost-block"><header><div><b>Custos mensais rateados automaticamente</b><small>Distribuídos usando a receita mensal estimada.</small></div><strong>{pricingSettings.financial.estimatedMonthlyRevenue>0?formatPercent(costModel.overheadRate):'Aguardando receita mensal'}</strong></header>{structureCosts.length||indirectTeamMonthly>0?<div>{structureCosts.map(item=><article key={item.id}><span><b>{item.description}</b><small>{item.category}</small></span><span><strong>{money(item.monthlyValue)}/mês</strong><em>Rateado automaticamente</em></span></article>)}{indirectTeamMonthly>0&&<article><span><b>Equipe indireta</b><small>Salários, encargos, benefícios e outros custos</small></span><span><strong>{money(indirectTeamMonthly)}/mês</strong><em>Rateado automaticamente</em></span></article>}</div>:<p>Nenhum custo mensal cadastrado. <Link href={`${routes.costs}?tab=estrutura`}>Cadastrar em Custos</Link></p>}</div><div className="specific-product-costs"><h4>Preencha para este produto <small>Opcional</small></h4><label className="operational-time-field"><span>Tempo de trabalho por unidade</span><input inputMode="decimal" value={laborMinutes||''} onChange={event=>setLaborMinutes(decimalFromInput(event.target.value))} placeholder="Ex.: 8 minutos"/><small>{directLaborHourlyCost>0?`Mão de obra adicionada ao produto: ${money(costModel.laborCost)}.`:'Cadastre uma função como equipe produtiva para ativar este cálculo.'}</small></label><div className="operational-preset-list">{operationalCosts.map((item,index)=><label key={item.kind}><span><b>{item.name}</b><small>Valor aproximado por unidade para farinha de bancada, óleo, pequenos descartáveis ou perdas não incluídas na ficha.</small></span><input inputMode="decimal" value={item.amount?money(item.amount):''} onChange={event=>setOperationalCosts(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,amount:parseBRL(event.target.value)}:row))} placeholder="R$ 0,00"/></label>)}</div></div><div className="builder-total"><span>Custos específicos por unidade</span><strong>{money(operationalTotal+costModel.laborCost)}</strong></div><div className="builder-total"><span>Custo direto completo</span><strong>{money(totalCost)}</strong></div></section>}
    {step===3&&selectiveCosts.length>0&&<section className="builder-surface utility-selector"><header className="stage-heading"><h4>Quais destes custos este produto utiliza?</h4><p>Marque somente os recursos usados neste produto. A NEQTA estima a participação sem pedir consumo em litros, kWh ou gás.</p></header><div>{selectiveCosts.map(cost=>{const usage=utilityUsages.find(item=>item.costId===cost.id);return <article className={usage?'selected':''} key={cost.id}><label><input type="checkbox" checked={Boolean(usage)} onChange={()=>setUtilityUsages(current=>usage?current.filter(item=>item.costId!==cost.id):[...current,{costId:cost.id,intensity:'medium'}])}/><span><b>{cost.description}</b><small>{cost.category} · {money(cost.monthlyValue)}/mês</small></span></label>{usage&&<div><span>Intensidade de uso</span>{([['low','Baixa'],['medium','Média'],['high','Alta']]as const).map(([value,label])=><button type="button" className={usage.intensity===value?'active':''} key={value} onClick={()=>setUtilityUsages(current=>current.map(item=>item.costId===cost.id?{...item,intensity:value}:item))}>{label}</button>)}</div>}</article>})}</div><p className="stage-note"><Info/>Baixa, média e alta usam pesos 1, 2 e 3 para distribuir o custo. A estimativa melhora quando houver histórico real de vendas.</p></section>}
    {error && <p className="wizard-error" role="alert">{error}</p>}
    <div className="wizard-actions"><button className={buttonClass('ghost')} onClick={step === 1 ? requestClose : () => { setError(''); setStep(step - 1); }}>{step === 1 ? 'Cancelar' : <><ChevronLeft />Voltar</>}</button>{step < 4 ? <button className={buttonClass('primary')} disabled={!canContinue()} onClick={next}>Continuar</button> : <button className={buttonClass('primary')} onClick={submit}>Salvar produto</button>}</div>
    {discarding && <DiscardConfirm keep={() => setDiscarding(false)} discard={close} />}{toast && <Toast message={toast} close={() => setToast('')} />}</div>
  </Overlay>;
}

function Toast({ message, close }: { message: string; close: () => void }) {
  return <div className="app-toast" role="status" aria-live="polite"><span><Check />{message}</span><button type="button" aria-label="Fechar notificação" onClick={close}><X /></button></div>;
}

function LabelWithInfo({ label, text }: { label: string; text: string }) { return <span className="label-with-info"><span>{label}</span><InfoTooltip text={text} label={`Ajuda sobre ${label}`} /></span>; }
function ComponentPicker({ items, selected, select }: { items: Array<Omit<ComponentLine, 'quantity'>>; selected: string; select: (id: string) => void }) {
  return <CustomSelect
    value={selected}
    onChange={select}
    ariaLabel="Ingrediente ou preparo"
    placeholder="Selecione um ingrediente ou preparo..."
    searchable
    searchPlaceholder="Digite o nome do ingrediente ou preparo..."
    emptyMessage="Nenhum ingrediente ou preparo encontrado."
    options={items.map((item) => ({
      value: item.id,
      label: item.name,
      secondary: `${money(item.unitCost)}/${item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}`,
      badge: item.type === 'RECEITA-BASE' ? 'Receita' : undefined,
    }))}
  />;
}
function InfoTooltip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false); document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, []);
  return <span className="info-tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><button type="button" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((value) => !value)}><Info /></button>{open && <span className="info-tooltip-popover" id={id} role="tooltip">{text}</span>}</span>;
}

function RecipeWizard({ recipe, close: finishClose, save }: { recipe: Product | null; close: () => void; save: (recipe: Product) => void | Promise<void> }) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [yieldQuantity, setYieldQuantity] = useState(recipe?.yieldQuantity ?? 0);
  const [yieldUnit, setYieldUnit] = useState(recipe?.yieldUnit ?? 'kg');
  const emptyIngredient: ComponentLine = { id: '', name: '', quantity: 0, unit: 'g', unitCost: 0 };
  const [draft, setDraft] = useState<ComponentLine>(emptyIngredient);
  const [ingredients, setIngredients] = useState<ComponentLine[]>((recipe?.components ?? []) as ComponentLine[]);
  const [availableIngredients, setAvailableIngredients] = useState<Array<Omit<ComponentLine, 'quantity'>>>([]);
  const ingredientOptions = availableIngredients;
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [recipeToast, setRecipeToast] = useState('');
  const [discardingRecipe, setDiscardingRecipe] = useState(false);
  const total = sumMoney(ingredients.map((item) => componentCost(item.quantity, item.unit, item.unitCost)));
  const unitCost = yieldQuantity > 0 && ingredients.length ? total / yieldQuantity : 0;
  const valid = Boolean(name.trim() && yieldQuantity > 0 && yieldUnit && ingredients.length);
  useEffect(() => {
    void costService.list().then((items) => setAvailableIngredients(items
      .filter((item) => item.type === 'ingredient')
      .map((item) => ({ id: item.id, name: item.name, type: 'INSUMO', unit: resolvedCostItemUnit(item), unitCost: normalizedComponentUnitCost(effectiveUnitCostForItem(item), effectiveUnitForItem(item) ?? item.purchaseUnit) }))))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os ingredientes.'));
  }, []);
  function chooseIngredient(id: string) { const option = availableIngredients.find((item) => item.id === id) ?? emptyIngredient; setDraft({ ...option, quantity: draft.quantity }); setError(''); }
  function resetDraft() { setDraft(emptyIngredient); setEditing(null); setError(''); }
  function addIngredient() { if (!draft.id) return setError('Selecione um ingrediente.'); if (draft.quantity <= 0) return setError('Informe quanto deste ingrediente você usa.'); if (!editing && ingredients.some((item) => item.id === draft.id && item.unit === draft.unit)) return setError('Este ingrediente já está na receita. Edite a quantidade existente ou cancele.'); const wasEditing = Boolean(editing); setIngredients((current) => editing ? current.map((item) => item.id === editing ? draft : item) : [...current, draft]); resetDraft(); setRecipeToast(wasEditing ? 'Ingrediente atualizado.' : 'Ingrediente adicionado.'); }
  async function submit() { if (!valid) return; setError(''); try { await save({ id: recipe?.id ?? `receita-${Date.now()}`, name: name.trim(), category: 'Receitas-base', variableCost: total, currentPrice: 0, projectedMargin: 0, targetMargin: 0, recommendedPrice: 0, status: 'recipe', kind: 'product', yield: `${yieldQuantity} ${yieldUnit} · ${money(unitCost)}/${yieldUnit}`, yieldQuantity, yieldUnit, unitCost, componentCount: ingredients.length, components: ingredients, packaging: [] }); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a receita-base.'); } }
  const dirtyRecipe = Boolean(name.trim() || yieldQuantity > 0 || draft.id || draft.quantity > 0 || ingredients.length);
  useEffect(() => { if (!recipeToast) return; const timer = window.setTimeout(() => setRecipeToast(''), 3000); return () => window.clearTimeout(timer); }, [recipeToast]);
  function close() { if (dirtyRecipe) setDiscardingRecipe(true); else finishClose(); }
  if (discardingRecipe) return <div className="confirm-layer recipe-discard-layer" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recipe-discard-title"><h2 id="recipe-discard-title">Descartar esta receita?</h2><p>Os dados preenchidos nesta receita-base serão perdidos.</p><div><button className={buttonClass('ghost')} onClick={() => setDiscardingRecipe(false)}>Continuar editando</button><button className="delete-button" onClick={finishClose}>Descartar</button></div></div></div>;
  return <Overlay title={recipe ? 'Editar receita-base' : 'Nova receita-base'} close={close} wide><div className="recipe-wizard"><div className="recipe-wizard-head"><p>Crie um preparo intermediário reutilizável na composição dos seus produtos.</p></div><section className="recipe-identification"><h3>Identificação</h3><div className="recipe-id-grid"><label>Nome da receita<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Molho da Casa" /></label><label><LabelWithInfo label="Quanto essa receita rende depois de pronta?" text="Informe quanto você obtém no final do preparo." /><span className="yield-fields"><input aria-label="Quantidade do rendimento" type="text" inputMode="decimal" value={yieldQuantity ? String(yieldQuantity).replace('.', ',') : ''} onChange={(event) => setYieldQuantity(decimalFromInput(event.target.value))} placeholder="Ex.: 3" /><CustomSelect value={yieldUnit} onChange={setYieldUnit} ariaLabel="Unidade do rendimento" options={['kg', 'g', 'L', 'ml', 'un'].map((unit) => ({ value: unit, label: unit }))} /></span></label></div></section><section className="recipe-composition-simple"><header><h3>Composição</h3><p>Adicione os ingredientes usados neste preparo.</p></header><div className="recipe-add-surface"><h4>Adicionar à receita</h4><label className="recipe-item-field">Ingrediente<CustomSelect value={draft.id} onChange={chooseIngredient} ariaLabel="Ingrediente" placeholder="Selecione um ingrediente..." options={ingredientOptions.map((item) => ({ value: item.id, label: item.name, secondary: `${money(item.unitCost)}/${item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}` }))} /></label><div className="recipe-amount-row"><label>Quantidade<input type="text" inputMode="decimal" value={draft.quantity ? String(draft.quantity).replace('.', ',') : ''} onChange={(event) => setDraft({ ...draft, quantity: decimalFromInput(event.target.value) })} placeholder="Ex.: 500" /></label><label>Unidade<CustomSelect value={draft.unit} onChange={(value) => setDraft({ ...draft, unit: value as Unit })} ariaLabel="Unidade" options={['g', 'kg', 'ml', 'L', 'un'].map((unit) => ({ value: unit, label: unit }))} /></label></div>{draft.id && <div className="recipe-cost-results"><span><small>Custo de referência</small><b>{money(draft.unitCost)}/{draft.unit === 'g' ? 'kg' : draft.unit === 'ml' ? 'L' : draft.unit}</b></span><span><small>Custo nesta receita</small><b>{money(componentCost(draft.quantity, draft.unit, draft.unitCost))}</b></span></div>}{draft.id && unusuallyHigh(draft.quantity, draft.unit) && <p className="quantity-warning"><Info />Essa quantidade parece muito alta para uma receita. Confira antes de continuar.</p>}<button type="button" className="builder-add" disabled={!draft.id || draft.quantity <= 0 || !draft.unit} onClick={addIngredient}><Plus />{editing ? 'Salvar alteração' : 'Adicionar à receita'}</button></div><h4 className="recipe-items-title">Itens da receita</h4>{ingredients.length ? <div className="builder-list premium-list recipe-items">{ingredients.map((item) => <article key={item.id}><div><b>{item.name}</b><span>{String(item.quantity).replace('.', ',')} {item.unit} × {money(item.unitCost)}/{item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}</span></div><div className="list-cost"><strong>{money(componentCost(item.quantity, item.unit, item.unitCost))}</strong></div><div className="list-actions"><button aria-label={`Editar ${item.name}`} onClick={() => { setDraft(item); setEditing(item.id); }}><Pencil />Editar</button><button aria-label={`Remover ${item.name}`} onClick={() => setIngredients((current) => current.filter((entry) => entry.id !== item.id))}><X /></button></div></article>)}</div> : <div className="recipe-empty compact"><Layers3 /><b>Nenhum ingrediente adicionado ainda.</b><span>Selecione um item acima para começar.</span></div>}<p className="ingredient-link">Não encontrou o ingrediente? <Link href={`${routes.costs}?tab=insumos`}>Ir para Insumos <ArrowRight /></Link></p></section><section className="recipe-summary-lines"><h3>Resumo</h3><div><span>Custo total</span><b>{ingredients.length ? money(total) : '—'}</b></div><div><span>Rendimento</span><b>{yieldQuantity > 0 ? `${String(yieldQuantity).replace('.', ',')} ${yieldUnit}` : '—'}</b></div><div><LabelWithInfo label={`Custo por ${yieldUnit || 'unidade'}`} text="Esse valor será usado automaticamente quando esta receita-base fizer parte de outro produto." /><b>{ingredients.length && yieldQuantity > 0 ? `${money(unitCost)}/${yieldUnit}` : '—'}</b></div></section>{error && <p className="wizard-error" role="alert">{error}</p>}{recipeToast && <Toast message={recipeToast} close={() => setRecipeToast('')} />}<div className="wizard-actions"><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className={buttonClass('primary')} disabled={!valid} onClick={submit}>Salvar receita-base</button></div></div></Overlay>;
}

type ImportPreview = {
  name: string;
  category: string;
  price: number;
  description: string;
  row: number;
  type: 'product' | 'recipe';
  yieldQuantity?: number;
  yieldUnit?: string;
  components: ProductComponent[];
  packaging: ProductPackaging[];
};

function normalizedImportHeader(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\*/g, '').trim().toLocaleLowerCase('pt-BR');
}

function ImportDrawer({ close }: { close: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function reviewFile() {
    if (!file || busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets['Produtos'] ?? workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('A planilha não possui uma aba de produtos.');
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const headerIndex = rows.findIndex((row) => row.some((cell) => normalizedImportHeader(cell) === 'nome do produto' || normalizedImportHeader(cell) === 'nome'));
      if (headerIndex < 0) throw new Error('Não encontrei o cabeçalho da aba Produtos. Baixe novamente o modelo da NEQTA.');
      const headers = rows[headerIndex].map(normalizedImportHeader);
      const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const nameColumn = column('nome do produto', 'nome');
      const categoryColumn = column('categoria');
      const priceColumn = column('preco de venda', 'preco_venda');
      const descriptionColumn = column('descricao (opcional)', 'descricao');
      const typeColumn = column('tipo', 'tipo de cadastro');
      const yieldQuantityColumn = column('rendimento', 'quantidade do rendimento');
      const yieldUnitColumn = column('unidade do rendimento', 'unidade_rendimento');
      const nextErrors: string[] = [];
      const nextPreview = rows.slice(headerIndex + 1).flatMap<ImportPreview>((row, index) => {
        const name = String(row[nameColumn] ?? '').trim();
        const category = String(row[categoryColumn] ?? '').trim();
        const rawPrice = row[priceColumn];
        const price = typeof rawPrice === 'number' ? rawPrice : parseBRL(String(rawPrice ?? ''));
        const rawType = normalizedImportHeader(row[typeColumn]);
        const type: ImportPreview['type'] = rawType === 'receita-base' || rawType === 'receita base' || rawType === 'receita' ? 'recipe' : 'product';
        const rawYield = row[yieldQuantityColumn];
        const yieldQuantity = typeof rawYield === 'number' ? rawYield : Number(String(rawYield ?? '').replace(',', '.'));
        const yieldUnit = String(row[yieldUnitColumn] ?? '').trim();
        const rowNumber = headerIndex + index + 2;
        if (!name && !category && !rawPrice && !rawType && !rawYield) return [];
        if (!name || (type === 'product' && (!category || !(price > 0)))) {
          nextErrors.push(`Linha ${rowNumber}: ${type === 'recipe' ? 'informe o nome da receita-base' : 'preencha nome, categoria e preço de venda'}.`);
          return [];
        }
        if (type === 'recipe' && (!(yieldQuantity > 0) || !['kg', 'g', 'l', 'ml', 'un'].includes(yieldUnit.toLocaleLowerCase('pt-BR')))) {
          nextErrors.push(`Linha ${rowNumber}: informe rendimento e unidade válida (kg, g, L, ml ou un) para a receita-base ${name}.`);
        }
        return [{ name, category: type === 'recipe' ? 'Receitas-base' : category, price: type === 'recipe' ? 0 : price, description: String(row[descriptionColumn] ?? '').trim(), row: rowNumber, type, yieldQuantity: type === 'recipe' ? yieldQuantity : undefined, yieldUnit: type === 'recipe' ? yieldUnit : undefined, components: [], packaging: [] }];
      });
      const duplicatedProducts = nextPreview.filter((product, index) => nextPreview.findIndex((entry) => normalizedImportHeader(entry.name) === normalizedImportHeader(product.name)) !== index);
      duplicatedProducts.forEach((product) => nextErrors.push(`Linha ${product.row}: o produto ${product.name} aparece mais de uma vez.`));
      const [costs, existingProducts] = await Promise.all([costService.list(), productsService.list()]);
      nextPreview.filter((product) => existingProducts.some((entry) => normalizedImportHeader(entry.name) === normalizedImportHeader(product.name)))
        .forEach((product) => nextErrors.push(`Linha ${product.row}: o produto ${product.name} já existe na NEQTA.`));

      const compositionSheetName = workbook.SheetNames.find((name) => normalizedImportHeader(name) === 'composicao');
      const compositionSheet = compositionSheetName ? workbook.Sheets[compositionSheetName] : undefined;
      if (compositionSheet) {
        const compositionRows = XLSX.utils.sheet_to_json<unknown[]>(compositionSheet, { header: 1, defval: '' });
        const compositionHeaderIndex = compositionRows.findIndex((row) => row.some((cell) => normalizedImportHeader(cell) === 'produto'));
        if (compositionHeaderIndex >= 0) {
          const compositionHeaders = compositionRows[compositionHeaderIndex].map(normalizedImportHeader);
          const compositionColumn = (...names: string[]) => compositionHeaders.findIndex((header) => names.includes(header));
          const productColumn = compositionColumn('produto');
          const itemColumn = compositionColumn('insumo');
          const quantityColumn = compositionColumn('quantidade usada', 'quantidade');
          compositionRows.slice(compositionHeaderIndex + 1).forEach((row, index) => {
            const productName = String(row[productColumn] ?? '').trim();
            const itemName = String(row[itemColumn] ?? '').trim();
            const rawQuantity = row[quantityColumn];
            const quantity = typeof rawQuantity === 'number' ? rawQuantity : Number(String(rawQuantity ?? '').replace(',', '.'));
            const rowNumber = compositionHeaderIndex + index + 2;
            if (!productName && !itemName && !rawQuantity) return;
            const product = nextPreview.find((entry) => normalizedImportHeader(entry.name) === normalizedImportHeader(productName));
            if (!product) {
              const alreadyExists = existingProducts.some((entry) => normalizedImportHeader(entry.name) === normalizedImportHeader(productName));
              nextErrors.push(`Composição, linha ${rowNumber}: ${alreadyExists ? `o produto ${productName} já existe e não será alterado por esta importação` : `produto ${productName || 'não informado'} não encontrado na aba Produtos`}.`);
              return;
            }
            const cost = costs.find((entry) => normalizedImportHeader(entry.name) === normalizedImportHeader(itemName));
            const matchingRecipe = nextPreview.find((entry) => entry.type === 'recipe' && normalizedImportHeader(entry.name) === normalizedImportHeader(itemName))
              ?? existingProducts.find((entry) => entry.status === 'recipe' && normalizedImportHeader(entry.name) === normalizedImportHeader(itemName));
            if (!cost && !matchingRecipe) {
              nextErrors.push(`Composição, linha ${rowNumber}: insumo ou receita-base ${itemName || 'não informado'} não encontrado na NEQTA.`);
              return;
            }
            if (!(quantity > 0)) {
              nextErrors.push(`Composição, linha ${rowNumber}: informe uma quantidade maior que zero para ${itemName}.`);
              return;
            }
            if (product.type === 'recipe' && (!cost || cost.type === 'packaging')) {
              nextErrors.push(`Composição, linha ${rowNumber}: receitas-base aceitam somente ingredientes cadastrados em Custos.`);
              return;
            }
            const referenceId = cost?.id ?? `recipe:${normalizedImportHeader(itemName)}`;
            const alreadyAdded = [...product.components, ...product.packaging].some((entry) => entry.id === referenceId);
            if (alreadyAdded) {
              nextErrors.push(`Composição, linha ${rowNumber}: ${itemName} já foi adicionado ao produto ${productName}.`);
              return;
            }
            if (cost?.type === 'packaging') {
              product.packaging.push({ id: cost.id, name: cost.name, quantity, unitCost: effectiveUnitCostForItem(cost) });
            } else if (cost) {
              const resolvedUnit = effectiveUnitForItem(cost) ?? cost.purchaseUnit;
              product.components.push({ id: cost.id, name: cost.name, type: 'INSUMO', quantity, unit: costItemUnit(resolvedUnit), unitCost: normalizedComponentUnitCost(effectiveUnitCostForItem(cost), resolvedUnit) });
            } else if (matchingRecipe) {
              const importedRecipeCost = 'type' in matchingRecipe
                ? matchingRecipe.components.reduce((sum, item) => sum + componentCost(item.quantity, item.unit as Unit, item.unitCost), 0) / (matchingRecipe.yieldQuantity || 1)
                : matchingRecipe.unitCost ?? 0;
              product.components.push({ id: referenceId, name: matchingRecipe.name, type: 'RECEITA-BASE', quantity, unit: (matchingRecipe.yieldUnit as Unit) || 'kg', unitCost: importedRecipeCost });
            }
          });
        }
      }
      nextPreview.filter((entry) => entry.type === 'recipe' && entry.components.length === 0)
        .forEach((entry) => nextErrors.push(`Linha ${entry.row}: adicione ao menos um ingrediente para a receita-base ${entry.name} na aba Composição.`));
      const importedRecipes = nextPreview.filter((entry) => entry.type === 'recipe');
      importedRecipes.forEach((recipe) => {
        const total = sumMoney(recipe.components.map((item) => componentCost(item.quantity, item.unit as Unit, item.unitCost)));
        const unitCost = recipe.yieldQuantity && recipe.yieldQuantity > 0 ? total / recipe.yieldQuantity : 0;
        nextPreview.forEach((entry) => entry.components.forEach((component) => {
          if (component.type === 'RECEITA-BASE' && normalizedImportHeader(component.name) === normalizedImportHeader(recipe.name)) component.unitCost = unitCost;
        }));
      });
      if (!nextPreview.length && !nextErrors.length) nextErrors.push('Nenhum produto preenchido foi encontrado. Apague a linha de exemplo somente depois de cadastrar seus produtos.');
      setPreview(nextPreview);
      setErrors(nextErrors);
      setStep(2);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Não foi possível ler este arquivo.']);
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function importProducts() {
    if (!preview.length || errors.length || busy) return;
    setBusy(true);
    try {
      const settings = await loadSettingsFromSupabase();
      const savedRecipes = new Map<string, Product>();
      for (const product of [...preview].sort((a, b) => Number(b.type === 'recipe') - Number(a.type === 'recipe'))) {
        const resolvedComponents = product.components.map((component) => {
          if (component.type !== 'RECEITA-BASE') return component;
          const saved = savedRecipes.get(normalizedImportHeader(component.name));
          return saved ? { ...component, id: saved.id, unitCost: saved.unitCost ?? component.unitCost } : component;
        });
        const componentsCost = resolvedComponents.reduce((total, item) => total + componentCost(item.quantity, item.unit as Unit, item.unitCost), 0);
        const packagingCost = product.packaging.reduce((total, item) => total + item.quantity * item.unitCost, 0);
        const saved = await productsService.create({
          name: product.name,
          category: product.category,
          currentPrice: product.price,
          targetMargin: settings.financial.targetMargin,
          description: product.description,
          components: resolvedComponents,
          packaging: product.packaging,
          variableCost: componentsCost + packagingCost,
          isBase: product.type === 'recipe',
          yieldQuantity: product.yieldQuantity,
          yieldUnit: product.yieldUnit,
        });
        if (product.type === 'recipe') savedRecipes.set(normalizedImportHeader(product.name), saved);
      }
      setStep(3);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Não foi possível importar os produtos.']);
    } finally {
      setBusy(false);
    }
  }

  return <Overlay title="Importar produtos" close={close}><div className="import-shell">
    <div className="import-steps improved-import-steps"><span className={step === 1 ? 'active' : ''}><b>1</b>Arquivo</span><span className={step === 2 ? 'active' : ''}><b>2</b>Revisão</span><span className={step === 3 ? 'active' : ''}><b>3</b>Importação</span></div>
    {step === 1 && <><section className="import-template-card"><div className="import-template-icon"><Download /></div><div><h3>Comece pelo modelo da NEQTA</h3><p>O arquivo tem um manual simples e abas para produtos, composição e insumos disponíveis. Você preenche somente as células amarelo-claro.</p></div><a className={buttonClass('secondary')} href="/modelos/modelo-importacao-produtos-neqta.xlsx" download="modelo-importacao-produtos-neqta.xlsx"><Download />Baixar modelo XLSX</a></section><div className="import-or"><span>depois de preencher</span></div><label className={`file-drop improved-file-drop${file ? ' has-file' : ''}`}><FileUp /><b>{file ? 'Arquivo selecionado' : 'Arraste ou selecione sua planilha'}</b><span>{file?.name ?? 'Formatos aceitos: XLSX, XLS ou CSV'}</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><div className="import-help"><b>Antes de continuar</b><span>Não altere os nomes das colunas. Você poderá revisar erros e dados antes de qualquer gravação no Supabase.</span></div><div className="drawer-actions import-drawer-actions"><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className={buttonClass('primary')} disabled={!file || busy} onClick={reviewFile}>{busy ? 'Lendo arquivo...' : 'Revisar arquivo'} <ArrowRight /></button></div></>}
    {step === 2 && <><section className="import-review-summary"><h3>{errors.length ? 'Revise os dados da planilha' : `${preview.length} ${preview.length === 1 ? 'item pronto' : 'itens prontos'} para importar`}</h3><p>Nada foi gravado ainda. Confira produtos, receitas-base, insumos e embalagens encontrados.</p></section>{errors.length > 0 && <div className="import-review-errors" role="alert">{errors.map((error) => <p key={error}><Info />{error}</p>)}</div>}{preview.length > 0 && <div className="import-review-list">{preview.map((product) => <article key={`${product.row}-${product.name}`}><div><b>{product.name}</b><span>{product.type === 'recipe' ? `Receita-base · rendimento ${product.yieldQuantity} ${product.yieldUnit}` : product.category} · {product.components.length} {product.components.length === 1 ? 'componente' : 'componentes'} · {product.packaging.length} {product.packaging.length === 1 ? 'embalagem' : 'embalagens'}</span></div><strong>{product.type === 'recipe' ? 'Receita-base' : money(product.price)}</strong></article>)}</div>}<div className="drawer-actions import-drawer-actions"><button className={buttonClass('ghost')} onClick={() => { setStep(1); setErrors([]); }}>Voltar</button><button className={buttonClass('primary')} disabled={!preview.length || Boolean(errors.length) || busy} onClick={importProducts}>{busy ? 'Importando...' : 'Importar itens'} <ArrowRight /></button></div></>}
    {step === 3 && <section className="import-success"><Check /><h3>Importação concluída</h3><p>{preview.length} {preview.length === 1 ? 'item foi adicionado' : 'itens foram adicionados'} ao seu sistema NEQTA.</p><button className={buttonClass('primary')} onClick={() => window.location.reload()}>Ver produtos e receitas</button></section>}
  </div></Overlay>;
}
function DiscardConfirm({ keep, discard }: { keep: () => void; discard: () => void }) { return <div className="confirm-layer wizard-confirm" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-title"><h2 id="discard-title">Descartar alterações?</h2><p>As informações preenchidas neste produto serão perdidas.</p><div><button className={buttonClass('ghost')} onClick={keep}>Continuar editando</button><button className="delete-button" onClick={discard}>Descartar</button></div></div></div>; }
function ConfirmDelete({ product, close, confirm }: { product: Product; close: () => void; confirm: () => void }) { return <div className="confirm-layer" role="presentation" onMouseDown={close}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onMouseDown={(e) => e.stopPropagation()}><h2 id="delete-title">Excluir {product.name}?</h2><p>Essa ação removerá o produto da sua lista.</p><div><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className="delete-button" onClick={confirm}>Excluir produto</button></div></div></div>; }
function Overlay({ title, close, wide, children }: { title: string; close: () => void; wide?: boolean; children: React.ReactNode }) {
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add('modal-open');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    window.setTimeout(() => dialog.current?.querySelector<HTMLElement>('button,input,select,textarea,a[href]')?.focus(), 0);
    return () => { document.removeEventListener('keydown', handleKey); document.body.classList.remove('modal-open'); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  if (!mounted) return null;
  return createPortal(<div className="product-overlay" role="presentation" onMouseDown={close}><section ref={dialog} className={`product-drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}><header><h2 id={titleId}>{title}</h2><button aria-label="Fechar" onClick={close}><X /></button></header><div className="product-drawer-content">{children}</div></section></div>, document.body);
}
