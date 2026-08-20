'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownUp, ArrowRight, Check, ChevronLeft, Download, FileUp, Info, Layers3, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { calculateMargin, formatPercent, marginForChannel, money, multiplyMoney, parseBRL, recommendedPriceForChannel, sumMoney } from '@/lib/financial';
import { componentCost, type Unit } from '@/lib/units';
import { productsService } from '@/services/products.service';
import { routes } from '@/config/routes';
import { sanitizeDecimal } from '@/lib/input';
import { defaultSettings, loadSettings } from '@/lib/settings';
import type { Product, ProductStatus } from '@/types/product';
import type { NeqtaSettings } from '@/types/settings';

type View = 'products' | 'recipes';
type Filter = 'all' | 'healthy' | 'warning' | 'critical' | 'review';
type SortKey = 'name' | 'variableCost' | 'currentPrice' | 'projectedMargin';
type ComponentLine = { id: string; name: string; type?: 'INSUMO' | 'RECEITA-BASE'; quantity: number; unit: Unit; unitCost: number };
type PackagingLine = { id: string; name: string; quantity: number; unitCost: number };

const componentOptions: Array<Omit<ComponentLine, 'quantity'>> = [
  { id: 'carne-bovina', name: 'Carne bovina', type: 'INSUMO', unit: 'g' as Unit, unitCost: 37.6 },
  { id: 'mucarela', name: 'Muçarela', type: 'INSUMO', unit: 'g' as Unit, unitCost: 42.9 },
  { id: 'pao-brioche', name: 'Pão brioche', type: 'INSUMO', unit: 'un' as Unit, unitCost: 1.85 },
  { id: 'molho-casa', name: 'Molho da Casa', type: 'RECEITA-BASE', unit: 'g' as Unit, unitCost: 8.2 },
];
const ingredientOptions = [
  { id: 'tomate', name: 'Tomate', unit: 'g' as Unit, unitCost: 8.9 },
  { id: 'maionese', name: 'Maionese', unit: 'g' as Unit, unitCost: 12.9 },
  { id: 'leite', name: 'Leite', unit: 'ml' as Unit, unitCost: 5.8 },
  { id: 'alho', name: 'Alho', unit: 'g' as Unit, unitCost: 24 },
  { id: 'azeite', name: 'Azeite', unit: 'ml' as Unit, unitCost: 38 },
  { id: 'ketchup', name: 'Ketchup', unit: 'g' as Unit, unitCost: 11.4 },
  { id: 'mostarda', name: 'Mostarda', unit: 'g' as Unit, unitCost: 13.5 },
];
const packagingOptions = [
  { id: 'caixa-burger', name: 'Caixa burger', unitCost: 1.2 },
  { id: 'pote-500', name: 'Pote 500 ml', unitCost: 1.65 },
  { id: 'tampa', name: 'Tampa', unitCost: .42 },
  { id: 'papel', name: 'Papel anti-gordura', unitCost: .18 },
];
type SalesChannel = { id: string; name: string; active: boolean; primary?: boolean; percentageFee?: number; fixedFee?: number; paymentHandledByChannel: boolean; feeConfigured: boolean };
function currencyFromInput(value: string) { return parseBRL(value); }
function decimalFromInput(value: string) { return sanitizeDecimal(value,3); }
function unusuallyHigh(quantity: number, unit: Unit) { return unit === 'g' || unit === 'ml' ? quantity > 10000 : unit === 'kg' || unit === 'L' ? quantity > 20 : quantity > 100; }

const filters: Array<[Filter, string]> = [['all', 'Todos'], ['healthy', 'Saudáveis'], ['warning', 'Atenção'], ['critical', 'Críticos']];
const statusLabel: Record<ProductStatus, string> = { healthy: 'Saudável', warning: 'Atenção', critical: 'Crítico', recipe: 'Receita-base' };

export function ProductsPage({ initialProducts, initialStatus, initialView }: { initialProducts: Product[]; initialStatus?: string; initialView?: string }) {
  const initialFilter: Filter = initialStatus === 'revisar' ? 'review' : filters.some(([key]) => key === initialStatus) ? initialStatus as Filter : 'all';
  const [products, setProducts] = useState(initialProducts);
  useEffect(() => {
    const sync = (incoming?: Product[]) => {
      try {
        const stored = incoming ?? JSON.parse(localStorage.getItem('neqta-products') ?? 'null') as Product[] | null;
        if (stored) setProducts(stored);
      } catch {}
    };
    const handle = (event: Event) => sync((event as CustomEvent<Product[]>).detail);
    sync();
    window.addEventListener('neqta-products-updated', handle);
    return () => window.removeEventListener('neqta-products-updated', handle);
  }, []);
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
  function duplicate(product: Product) { const copy={ ...product, id: `${product.id}-copia-${Date.now()}`, name: `${product.name} — cópia` };void productsService.save(copy);setActionFor(null); }

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
    {wizard && <ProductWizard product={wizard === 'new' ? null : wizard} close={() => setWizard(null)} save={(product) => { void productsService.save(product);setWizard(null);setPageToast('Produto salvo.'); }} />}
    {recipeWizard && <RecipeWizard recipe={recipeWizard === 'new' ? null : recipeWizard} close={() => setRecipeWizard(null)} save={(recipe) => { void productsService.save(recipe);setRecipeWizard(null);setPageToast('Receita-base salva.'); }} />}
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
  const [category, setCategory] = useState(product?.category ?? 'Lanches');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(product?.currentPrice ?? 0);
  const [pricingSettings,setPricingSettings]=useState<NeqtaSettings>(defaultSettings);
  const target = pricingSettings.financial.targetMargin;
  const [components, setComponents] = useState<ComponentLine[]>([]);
  const [availableComponents, setAvailableComponents] = useState<Array<Omit<ComponentLine, 'quantity'>>>(componentOptions);
  const [component, setComponent] = useState<ComponentLine>({ ...initialComponent, quantity: 0 });
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackagingLine[]>([]);
  const [packaging, setPackaging] = useState<PackagingLine>(initialPackaging);
  const [editingPackaging, setEditingPackaging] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(()=>{setPricingSettings(loadSettings());const sync=(event:Event)=>setPricingSettings((event as CustomEvent<NeqtaSettings>).detail);window.addEventListener('neqta-settings-updated',sync);return()=>window.removeEventListener('neqta-settings-updated',sync)},[]);

  const componentsCost = sumMoney(components.map((item) => componentCost(item.quantity, item.unit, item.unitCost)));
  const packagingCost = sumMoney(packages.map((item) => multiplyMoney(item.quantity, item.unitCost)));
  const totalCost = sumMoney([componentsCost, packagingCost]);
  const margin = calculateMargin(price, totalCost);
  const salesChannels:SalesChannel[]=pricingSettings.channels.map((channel,index)=>({id:channel.id,name:channel.name,active:channel.active,primary:channel.id==='store'||index===0,percentageFee:channel.percentageFee+pricingSettings.financial.salesTax,fixedFee:channel.fixedFee,paymentHandledByChannel:channel.processesPayment,feeConfigured:true}));
  const paymentMethods=pricingSettings.payments.filter(method=>method.active).map(method=>({...method,percentageFee:method.percentageFee+method.anticipationFee+pricingSettings.financial.salesTax}));
  const channelPrices = salesChannels.filter((channel) => channel.active).map((channel) => ({ ...channel, recommended: channel.feeConfigured ? recommendedPriceForChannel(totalCost, target, channel.percentageFee, channel.fixedFee) : null, currentMargin: channel.feeConfigured ? marginForChannel(price, totalCost, channel.percentageFee, channel.fixedFee) : null }));
  const paymentPrices = paymentMethods.map((method) => ({ ...method, recommended: recommendedPriceForChannel(totalCost, target, method.percentageFee, method.fixedFee) }));
  const primaryRecommended = channelPrices.find((channel) => channel.primary)?.recommended ?? channelPrices[0]?.recommended ?? totalCost;
  const dirty = name !== (product?.name ?? '') || category !== (product?.category ?? 'Lanches') || description !== '' || price !== (product?.currentPrice ?? 0) || components.length > 0 || packages.length > 0;

  function requestClose() { if (dirty) setDiscarding(true); else close(); }
  function resetComponent() { setComponent({ ...initialComponent, quantity: 0 }); setEditingComponent(null); setError(''); }
  function selectComponent(id: string) { const option = availableComponents.find((item) => item.id === id) ?? initialComponent; setComponent({ ...option, quantity: component.quantity }); setError(''); }
  function saveCreatedRecipe(recipe: Product) {
    const recipeOption: Omit<ComponentLine, 'quantity'> = { id: recipe.id, name: recipe.name, type: 'RECEITA-BASE', unit: (recipe.yieldUnit as Unit) || 'kg', unitCost: recipe.unitCost ?? 0 };
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
  function selectPackaging(id: string) { const option = packagingOptions.find((item) => item.id === id) ?? initialPackaging; setPackaging({ ...option, quantity: packaging.quantity }); setError(''); }
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
  function submit() { save({ id: product?.id ?? `produto-${Date.now()}`, name: name.trim(), category, kind: 'product', variableCost: totalCost, currentPrice: price, projectedMargin: margin, targetMargin: target, recommendedPrice: primaryRecommended ?? totalCost, status: price <= 0 || margin < target - 8 ? 'critical' : margin < target ? 'warning' : 'healthy' }); }

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);
  if (creatingRecipe) return <RecipeWizard recipe={null} close={() => setCreatingRecipe(false)} save={saveCreatedRecipe} />;
  return <Overlay title={product ? 'Editar produto' : 'Novo produto'} close={requestClose} wide><div className="wizard-inner">
    <div className="wizard-progress">{['Informações', 'Composição', 'Embalagem', 'Resumo'].map((label, index) => { const number = index + 1; const complete = number < step; return <button type="button" disabled={number > step} className={number === step ? 'active current' : complete ? 'active complete' : ''} onClick={() => complete && setStep(number)} key={label}><b>{complete ? <Check /> : number}</b><span>{label}</span></button>; })}</div>
    {step === 1 && <div className="form-grid wizard-form"><label>Nome do produto<input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ex.: X-Bacon" /></label><label>Categoria<CustomSelect value={category} onChange={setCategory} ariaLabel="Categoria" options={['Lanches', 'Acompanhamentos', 'Bebidas', 'Combos'].map((label) => ({ value: label, label }))} /><small className="field-help">Use categorias para organizar sua lista de produtos.</small></label><label><LabelWithInfo label="Preço atual" text="Quanto você cobra por este produto hoje. Se ainda não vende este item, pode deixar em branco." /><input aria-label="Preço atual" type="text" inputMode="decimal" value={price > 0 ? money(price) : ''} placeholder="R$ 0,00" onChange={(event) => setPrice(currencyFromInput(event.target.value))} /></label><div className="company-margin"><LabelWithInfo label="Meta de margem da empresa" text="É a meta padrão definida nas configurações da empresa. Ela é usada como referência para os preços recomendados." /><b>{formatPercent(target)}</b><small>Aplicada automaticamente pela NEQTA.</small></div><label className="full">Descrição <small>Opcional</small><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Hambúrguer artesanal com bacon, queijo e molho da casa." /></label></div>}
    {step === 2 && <div className="wizard-stage guided-builder"><header className="stage-heading"><h3>Composição</h3><p>Adicione tudo o que é usado para produzir uma unidade deste produto.</p></header><p className="stage-note"><Info />Você pode usar ingredientes comprados ou preparos que já deixou cadastrados.</p><section className="builder-surface"><h4>Adicionar à composição</h4><div className="builder-main-field"><span className="picker-label">Ingrediente ou preparo</span><ComponentPicker items={availableComponents} selected={component.id} select={selectComponent} /></div><div className="builder-input-row"><label>Quantidade<input type="text" inputMode="decimal" value={component.quantity ? String(component.quantity).replace('.', ',') : ''} onChange={(event) => setComponent({ ...component, quantity: decimalFromInput(event.target.value) })} placeholder="0" /></label><label>Unidade<CustomSelect value={component.unit} onChange={(value) => setComponent({ ...component, unit: value as Unit })} ariaLabel="Unidade" options={['g', 'kg', 'ml', 'L', 'un', 'cx', 'pacote', 'dúzia'].map((unit) => ({ value: unit, label: unit }))} /></label></div>{component.id && <div className="builder-results"><span><small>Custo de referência</small><b>{money(component.unitCost)}/{component.unit === 'g' ? 'kg' : component.unit === 'ml' ? 'L' : component.unit}</b></span><span><LabelWithInfo label="Custo neste produto" text="Calculado automaticamente a partir da quantidade utilizada e do custo cadastrado." /><b>{money(componentCost(component.quantity, component.unit, component.unitCost))}</b></span></div>}{component.id && unusuallyHigh(component.quantity, component.unit) && <p className="quantity-warning"><Info />Essa quantidade parece muito alta para uma unidade do produto. Confira antes de continuar.</p>}<div className="builder-actions"><button type="button" className="builder-add" disabled={!component.id || component.quantity <= 0 || !component.unit} onClick={addComponent}><Plus />{editingComponent ? 'Salvar alteração' : 'Adicionar à composição'}</button></div></section><aside className="recipe-context"><div><b>Não encontrou um preparo que você produz?</b><small>Ex.: molho da casa, maionese especial ou carne temperada.</small></div><button type="button" onClick={() => setCreatingRecipe(true)}><Plus />Criar receita-base</button></aside><section className="added-section"><h4>Componentes adicionados</h4>{components.length > 0 ? <div className="builder-list premium-list">{components.map((item) => <article key={item.id}><div><b>{item.name}{item.type === 'RECEITA-BASE' && <em className="recipe-badge"><Layers3 />Receita</em>}</b><span>{String(item.quantity).replace('.', ',')} {item.unit} × {money(item.unitCost)}/{item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}</span></div><div className="list-cost"><small>Custo no produto</small><strong>{money(componentCost(item.quantity, item.unit, item.unitCost))}</strong></div><div className="list-actions"><button type="button" aria-label={`Editar ${item.name}`} onClick={() => editComponent(item)}><Pencil />Editar</button><button type="button" aria-label={`Remover ${item.name}`} onClick={() => removeComponent(item.id)}><X /></button></div></article>)}</div> : <p className="builder-empty-line">Nenhum item adicionado à composição.</p>}<div className="builder-total"><span>Custo dos componentes</span><strong>{money(componentsCost)}</strong></div></section><p className="ingredient-link">Não encontrou um ingrediente comprado? <Link href={`${routes.costs}?tab=insumos`}>Ir para Custos &gt; Insumos <ArrowRight /></Link></p></div>}
    {step === 3 && <div className="wizard-stage guided-builder"><header className="stage-heading"><h3>Embalagem</h3><p>Adicione as embalagens utilizadas exclusivamente para vender uma unidade deste produto.</p></header><section className="builder-surface"><h4>Adicionar embalagem</h4><label className="builder-main-field">Embalagem<CustomSelect value={packaging.id} onChange={selectPackaging} ariaLabel="Embalagem" placeholder="Selecione uma embalagem..." options={packagingOptions.map((item) => ({ value: item.id, label: item.name }))} /></label><div className="builder-input-row single"><label>Quantidade<input type="text" inputMode="decimal" value={packaging.quantity ? String(packaging.quantity).replace('.', ',') : ''} onChange={(event) => setPackaging({ ...packaging, quantity: decimalFromInput(event.target.value) })} placeholder="0" /></label></div>{packaging.id && <div className="builder-results"><span><small>Custo unitário</small><b>{money(packaging.unitCost)}</b></span><span><small>Total da seleção</small><b>{money(multiplyMoney(packaging.quantity, packaging.unitCost))}</b></span></div>}<div className="builder-actions"><button type="button" className="builder-add" disabled={!packaging.id || packaging.quantity <= 0} onClick={addPackaging}><Plus />{editingPackaging ? 'Salvar alteração' : 'Adicionar embalagem'}</button></div></section><section className="added-section"><h4>Embalagens adicionadas</h4>{packages.length ? <div className="builder-list premium-list">{packages.map((item) => <article key={item.id}><div><b>{item.name}</b><span>{String(item.quantity).replace('.', ',')} {item.quantity === 1 ? 'unidade' : 'unidades'}</span></div><div className="list-cost"><small>Custo</small><strong>{money(multiplyMoney(item.quantity, item.unitCost))}</strong></div><div className="list-actions"><button type="button" aria-label={`Editar ${item.name}`} onClick={() => editPackaging(item)}><Pencil />Editar</button><button type="button" aria-label={`Remover ${item.name}`} onClick={() => removePackaging(item.id)}><X /></button></div></article>)}</div> : <div className="builder-empty-light"><b>Nenhuma embalagem adicionada.</b><span>Este produto não usa embalagem própria? Você pode continuar sem adicionar nenhuma.</span></div>}<div className="builder-total"><span>Custo das embalagens</span><strong>{money(packagingCost)}</strong></div></section><p className="context-note"><Info />Sacolas, lacres e itens usados no pedido inteiro são configurados separadamente.</p></div>}
    {step === 4 && <div className="wizard-summary premium-summary"><div className="summary-foundation"><section className="cost-ledger"><h3>Custo do produto</h3><div><span>Componentes</span><b>{money(componentsCost)}</b></div><div><span>Embalagens</span><b>{money(packagingCost)}</b></div><div className="cost-total"><span>Custo variável total</span><strong>{money(totalCost)}</strong></div></section><section className="margin-references"><h3>Referências</h3><div><LabelWithInfo label="Meta da empresa" text="É a meta padrão definida nas configurações da empresa." /><b>{formatPercent(target)}</b></div><div><span><LabelWithInfo label="Margem mínima NEQTA" text="Estimativa baseada na estrutura e nas projeções cadastradas." /></span><b>{formatPercent(pricingSettings.financial.minimumMargin)}</b></div><div className="current-price-line"><span>Preço praticado hoje</span><strong>{price > 0 ? money(price) : 'Não informado'}</strong></div></section></div><section className="channel-comparison"><header><h3><LabelWithInfo label="Preços recomendados" text="Cada canal possui taxas diferentes. A NEQTA calcula um preço recomendado para preservar sua meta em cada cenário." /></h3><p>Calculados de acordo com as taxas configuradas em cada canal.</p></header><div className="channel-rows">{channelPrices.map((channel) => channel.feeConfigured ? <button type="button" className={channel.primary ? 'channel-row primary-channel' : 'channel-row'} key={channel.id} onClick={() => channel.id === 'store' && setShowPayments(true)}><span className="channel-name"><b>{channel.name}</b>{channel.primary && <em>Principal</em>}</span><span className="channel-fee">{channel.percentageFee ? `Taxas ${formatPercent(channel.percentageFee)}` : 'Sem taxa'}</span><strong>{money(channel.recommended ?? 0)}</strong><span className="channel-meta">Meta {formatPercent(target)}</span><ArrowRight /></button> : <Link className="channel-row" key={channel.id} href={routes.settings}><span className="channel-name"><b>{channel.name}</b></span><span className="channel-fee">Taxa não configurada</span><strong>—</strong><span className="channel-meta">Configurar</span><ArrowRight /></Link>)}</div></section>{showPayments && <div className="payment-layer" role="presentation" onMouseDown={() => setShowPayments(false)}><section role="dialog" aria-modal="true" aria-label="Preços por forma de pagamento" onMouseDown={(event) => event.stopPropagation()}><header><div><h3>Loja por forma de pagamento</h3><p>As taxas abaixo são aplicadas somente à venda direta.</p></div><button type="button" aria-label="Fechar" onClick={() => setShowPayments(false)}><X /></button></header>{paymentPrices.map((method) => <article key={method.id}><div><b>{method.name}</b><small>Taxa: {formatPercent(method.percentageFee)}</small></div><div><small>Preço sugerido</small><strong>{money(method.recommended)}</strong></div></article>)}</section></div>}</div>}
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

function RecipeWizard({ recipe, close: finishClose, save }: { recipe: Product | null; close: () => void; save: (recipe: Product) => void }) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [yieldQuantity, setYieldQuantity] = useState(recipe?.yieldQuantity ?? 0);
  const [yieldUnit, setYieldUnit] = useState(recipe?.yieldUnit ?? 'kg');
  const emptyIngredient: ComponentLine = { id: '', name: '', quantity: 0, unit: 'g', unitCost: 0 };
  const [draft, setDraft] = useState<ComponentLine>(emptyIngredient);
  const [ingredients, setIngredients] = useState<ComponentLine[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [recipeToast, setRecipeToast] = useState('');
  const [discardingRecipe, setDiscardingRecipe] = useState(false);
  const total = ingredients.reduce((sum, item) => sum + componentCost(item.quantity, item.unit, item.unitCost), 0);
  const unitCost = yieldQuantity > 0 && ingredients.length ? total / yieldQuantity : 0;
  const valid = Boolean(name.trim() && yieldQuantity > 0 && yieldUnit && ingredients.length);
  function chooseIngredient(id: string) { const option = ingredientOptions.find((item) => item.id === id) ?? emptyIngredient; setDraft({ ...option, quantity: draft.quantity }); setError(''); }
  function resetDraft() { setDraft(emptyIngredient); setEditing(null); setError(''); }
  function addIngredient() { if (!draft.id) return setError('Selecione um ingrediente.'); if (draft.quantity <= 0) return setError('Informe quanto deste ingrediente você usa.'); if (!editing && ingredients.some((item) => item.id === draft.id && item.unit === draft.unit)) return setError('Este ingrediente já está na receita. Edite a quantidade existente ou cancele.'); const wasEditing = Boolean(editing); setIngredients((current) => editing ? current.map((item) => item.id === editing ? draft : item) : [...current, draft]); resetDraft(); setRecipeToast(wasEditing ? 'Ingrediente atualizado.' : 'Ingrediente adicionado.'); }
  function submit() { if (!valid) return; save({ id: recipe?.id ?? `receita-${Date.now()}`, name: name.trim(), category: 'Receitas-base', variableCost: total, currentPrice: 0, projectedMargin: 0, targetMargin: 0, recommendedPrice: 0, status: 'recipe', kind: 'product', yield: `${yieldQuantity} ${yieldUnit} · ${money(unitCost)}/${yieldUnit}`, yieldQuantity, yieldUnit, unitCost, componentCount: ingredients.length }); }
  const dirtyRecipe = Boolean(name.trim() || yieldQuantity > 0 || draft.id || draft.quantity > 0 || ingredients.length);
  useEffect(() => { if (!recipeToast) return; const timer = window.setTimeout(() => setRecipeToast(''), 3000); return () => window.clearTimeout(timer); }, [recipeToast]);
  function close() { if (dirtyRecipe) setDiscardingRecipe(true); else finishClose(); }
  if (discardingRecipe) return <div className="confirm-layer recipe-discard-layer" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="recipe-discard-title"><h2 id="recipe-discard-title">Descartar esta receita?</h2><p>Os dados preenchidos nesta receita-base serão perdidos.</p><div><button className={buttonClass('ghost')} onClick={() => setDiscardingRecipe(false)}>Continuar editando</button><button className="delete-button" onClick={finishClose}>Descartar</button></div></div></div>;
  return <Overlay title={recipe ? 'Editar receita-base' : 'Nova receita-base'} close={close} wide><div className="recipe-wizard"><div className="recipe-wizard-head"><p>Crie um preparo intermediário reutilizável na composição dos seus produtos.</p></div><section className="recipe-identification"><h3>Identificação</h3><div className="recipe-id-grid"><label>Nome da receita<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Molho da Casa" /></label><label><LabelWithInfo label="Quanto essa receita rende depois de pronta?" text="Informe quanto você obtém no final do preparo." /><span className="yield-fields"><input aria-label="Quantidade do rendimento" type="text" inputMode="decimal" value={yieldQuantity ? String(yieldQuantity).replace('.', ',') : ''} onChange={(event) => setYieldQuantity(decimalFromInput(event.target.value))} placeholder="Ex.: 3" /><CustomSelect value={yieldUnit} onChange={setYieldUnit} ariaLabel="Unidade do rendimento" options={['kg', 'g', 'L', 'ml', 'un'].map((unit) => ({ value: unit, label: unit }))} /></span></label></div></section><section className="recipe-composition-simple"><header><h3>Composição</h3><p>Adicione os ingredientes usados neste preparo.</p></header><div className="recipe-add-surface"><h4>Adicionar à receita</h4><label className="recipe-item-field">Ingrediente<CustomSelect value={draft.id} onChange={chooseIngredient} ariaLabel="Ingrediente" placeholder="Selecione um ingrediente..." options={ingredientOptions.map((item) => ({ value: item.id, label: item.name, secondary: `${money(item.unitCost)}/${item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}` }))} /></label><div className="recipe-amount-row"><label>Quantidade<input type="text" inputMode="decimal" value={draft.quantity ? String(draft.quantity).replace('.', ',') : ''} onChange={(event) => setDraft({ ...draft, quantity: decimalFromInput(event.target.value) })} placeholder="Ex.: 500" /></label><label>Unidade<CustomSelect value={draft.unit} onChange={(value) => setDraft({ ...draft, unit: value as Unit })} ariaLabel="Unidade" options={['g', 'kg', 'ml', 'L', 'un'].map((unit) => ({ value: unit, label: unit }))} /></label></div>{draft.id && <div className="recipe-cost-results"><span><small>Custo de referência</small><b>{money(draft.unitCost)}/{draft.unit === 'g' ? 'kg' : draft.unit === 'ml' ? 'L' : draft.unit}</b></span><span><small>Custo nesta receita</small><b>{money(componentCost(draft.quantity, draft.unit, draft.unitCost))}</b></span></div>}{draft.id && unusuallyHigh(draft.quantity, draft.unit) && <p className="quantity-warning"><Info />Essa quantidade parece muito alta para uma receita. Confira antes de continuar.</p>}<button type="button" className="builder-add" disabled={!draft.id || draft.quantity <= 0 || !draft.unit} onClick={addIngredient}><Plus />{editing ? 'Salvar alteração' : 'Adicionar à receita'}</button></div><h4 className="recipe-items-title">Itens da receita</h4>{ingredients.length ? <div className="builder-list premium-list recipe-items">{ingredients.map((item) => <article key={item.id}><div><b>{item.name}</b><span>{String(item.quantity).replace('.', ',')} {item.unit} × {money(item.unitCost)}/{item.unit === 'g' ? 'kg' : item.unit === 'ml' ? 'L' : item.unit}</span></div><div className="list-cost"><strong>{money(componentCost(item.quantity, item.unit, item.unitCost))}</strong></div><div className="list-actions"><button aria-label={`Editar ${item.name}`} onClick={() => { setDraft(item); setEditing(item.id); }}><Pencil />Editar</button><button aria-label={`Remover ${item.name}`} onClick={() => setIngredients((current) => current.filter((entry) => entry.id !== item.id))}><X /></button></div></article>)}</div> : <div className="recipe-empty compact"><Layers3 /><b>Nenhum ingrediente adicionado ainda.</b><span>Selecione um item acima para começar.</span></div>}<p className="ingredient-link">Não encontrou o ingrediente? <Link href={`${routes.costs}?tab=insumos`}>Ir para Insumos <ArrowRight /></Link></p></section><section className="recipe-summary-lines"><h3>Resumo</h3><div><span>Custo total</span><b>{ingredients.length ? money(total) : '—'}</b></div><div><span>Rendimento</span><b>{yieldQuantity > 0 ? `${String(yieldQuantity).replace('.', ',')} ${yieldUnit}` : '—'}</b></div><div><LabelWithInfo label={`Custo por ${yieldUnit || 'unidade'}`} text="Esse valor será usado automaticamente quando esta receita-base fizer parte de outro produto." /><b>{ingredients.length && yieldQuantity > 0 ? `${money(unitCost)}/${yieldUnit}` : '—'}</b></div></section>{error && <p className="wizard-error" role="alert">{error}</p>}{recipeToast && <Toast message={recipeToast} close={() => setRecipeToast('')} />}<div className="wizard-actions"><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className={buttonClass('primary')} disabled={!valid} onClick={submit}>Salvar receita-base</button></div></div></Overlay>;
}

function ImportDrawer({ close }: { close: () => void }) { const [file, setFile] = useState(''); return <Overlay title="Importar produtos" close={close}><div className="import-steps"><span className="active">1 Selecionar arquivo</span><span>2 Revisar</span><span>3 Importar</span></div><label className="file-drop"><FileUp /><b>Selecionar arquivo</b><span>Planilha XLSX ou CSV</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} /></label>{file && <p>Arquivo selecionado: <b>{file}</b></p>}<button className={buttonClass('secondary')}><Download />Baixar modelo</button><div className="drawer-actions"><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className={buttonClass('primary')} disabled={!file}>Revisar arquivo</button></div></Overlay>; }
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
