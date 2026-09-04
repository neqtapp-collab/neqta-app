'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, MoreHorizontal, Plus, Search, Sparkles, X } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { formatPercent, marginForChannel, money, parseBRL, parsePercent } from '@/lib/financial';
import { todayISO } from '@/lib/date';
import { productsService } from '@/services/products.service';
import { promotionDismissalsService, promotionsService } from '@/services/promotions.service';
import { routes } from '@/config/routes';
import { defaultSettings, loadSettingsFromSupabase } from '@/lib/settings';
import { evaluateProductPricing } from '@/lib/pricing-evaluation';
import { evaluatePromotionScenario, promotionSafeLimit, promotionStatus } from '@/lib/promotion-evaluation';
import type { NeqtaSettings } from '@/types/settings';
import type { Product } from '@/types/product';
import type { StructureCost } from '@/types/cost';
import type { Promotion, PromotionSource, PromotionStatus, PromotionType } from '@/types/promotion';

type Filter = 'all' | 'neqta' | 'manual' | 'active' | 'ended';
type PromotionRow = Promotion & { product: Product; maxDiscount: number };

const channels = [
  { id: 'store', name: 'Loja', fee: 0 },
  { id: 'ifood', name: 'iFood', fee: 23 },
  { id: '99', name: '99', fee: 14 },
];
const statusLabels: Record<PromotionStatus, string> = {
  safe: 'Segura',
  warning: 'Atenção',
  unsafe: 'Não recomendada',
  active: 'Ativa',
  ended: 'Encerrada',
};
const typeLabels: Record<PromotionType, string> = {
  percentage: 'Desconto percentual',
  fixed: 'Desconto em R$',
  price: 'Preço promocional',
  take2: 'Leve 2',
  combo: 'Combo',
};

function safeLimit(product: Product, minimumMargin = 25) {
  const result = promotionSafeLimit(product, minimumMargin);
  return { minimumPrice: result.minimumPrice, maxDiscount: result.maxDiscount };
}

function commercialDiscount(maximum: number) {
  return [20, 15, 10, 5].find((value) => value <= maximum) ?? 0;
}

function sourceLabel(source: PromotionSource) {
  return source === 'neqta' ? 'NEQTA' : 'Manual';
}

function evaluatePromotion(product: Product, promotion: Pick<Promotion, 'promotionalPrice' | 'type' | 'secondaryProductId'>, minimumMargin = 25, products: Product[] = []) {
  const secondaryProduct = promotion.type === 'combo'
    ? products.find((item) => item.id === promotion.secondaryProductId)
    : undefined;
  return evaluatePromotionScenario(product, promotion.promotionalPrice, minimumMargin, secondaryProduct);
}

function suggestionSignature(parts: Array<string | number | undefined>) {
  const input = parts.map((part) => typeof part === 'number' ? part.toFixed(2) : part ?? '').join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildSuggestion(product: Product, type: PromotionType, promotionalPrice: number, minimumMargin: number, products: Product[], secondaryProductId?: string): PromotionRow | null {
  const referencePrice = product.currentPrice + (products.find((item) => item.id === secondaryProductId)?.currentPrice ?? 0);
  const discountValue = referencePrice > 0
    ? Math.round(Math.max(0, (1 - promotionalPrice / referencePrice) * 100) * 100) / 100
    : 0;
  const evaluation = evaluatePromotion(product, { type, promotionalPrice, secondaryProductId }, minimumMargin, products);
  if (discountValue < 1 || !evaluation.valid) return null;
  const signature = suggestionSignature([
    product.id, type, secondaryProductId, product.currentPrice, product.variableCost,
    products.find((item) => item.id === secondaryProductId)?.currentPrice,
    products.find((item) => item.id === secondaryProductId)?.variableCost,
    minimumMargin, promotionalPrice,
  ]);
  return {
    id: `neqta-${type}-${product.id}-${signature}`,
    productId: product.id,
    secondaryProductId,
    type,
    discountValue,
    promotionalPrice,
    marginAfterPromotion: evaluation.margin,
    channels: ['store'],
    source: 'neqta',
    status: evaluation.classification,
    createdAt: todayISO(),
    maxDiscount: safeLimit(product, minimumMargin).maxDiscount,
    product,
  };
}

function opportunitySuggestions(products: Product[], minimumMargin: number) {
  const typePriority: Record<PromotionType, number> = {
    percentage: 5,
    price: 4,
    fixed: 3,
    take2: 2,
    combo: 1,
  };
  return products.flatMap((product) => {
    const limit = safeLimit(product, minimumMargin);
    const commercial = commercialDiscount(limit.maxDiscount);
    if (!commercial) return [];
    const targetPrice = product.currentPrice * (1 - commercial / 100);
    const fixedDiscount = Math.floor((product.currentPrice - limit.minimumPrice) * 2) / 2;
    const charmPrice = Math.max(limit.minimumPrice, Math.floor(targetPrice) - 0.1);
    const candidates: Array<PromotionRow | null> = [
      buildSuggestion(product, 'percentage', targetPrice, minimumMargin, products),
      fixedDiscount >= 1 ? buildSuggestion(product, 'fixed', product.currentPrice - fixedDiscount, minimumMargin, products) : null,
      charmPrice < product.currentPrice ? buildSuggestion(product, 'price', charmPrice, minimumMargin, products) : null,
      buildSuggestion(product, 'take2', targetPrice, minimumMargin, products),
      ...products.filter((secondary) => secondary.id !== product.id).map((secondary) => {
        const comboDiscount = commercialDiscount(Math.min(limit.maxDiscount, safeLimit(secondary, minimumMargin).maxDiscount));
        return comboDiscount
          ? buildSuggestion(product, 'combo', (product.currentPrice + secondary.currentPrice) * (1 - comboDiscount / 100), minimumMargin, products, secondary.id)
          : null;
      }),
    ];
    const validCandidates = candidates.filter((candidate): candidate is PromotionRow => candidate !== null);
    const safeCandidates = validCandidates.filter((candidate) => candidate.status === 'safe');
    const pool = safeCandidates.length ? safeCandidates : validCandidates;
    const best = pool.sort((left, right) =>
      right.discountValue - left.discountValue
      || typePriority[right.type] - typePriority[left.type]
      || right.marginAfterPromotion - left.marginAfterPromotion,
    )[0];
    return best ? [best] : [];
  });
}

export function PromotionsPage({ initialProducts, initialPromotions, initialDismissedSuggestionIds = [], initialSettings = defaultSettings, monthlyOverhead = 0, selectiveCosts = [], directLaborHourlyCost = 0 }: { initialProducts: Product[]; initialPromotions: Promotion[]; initialDismissedSuggestionIds?: string[]; initialSettings?: NeqtaSettings; monthlyOverhead?: number; selectiveCosts?: StructureCost[]; directLaborHourlyCost?: number }) {
  const [rawProducts,setProducts]=useState(initialProducts.filter((product) => product.status !== 'recipe'));
  const [saved, setSaved] = useState<Promotion[]>(initialPromotions);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState(initialDismissedSuggestionIds);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<{ product: Product; promotion?: Promotion; source: PromotionSource } | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [settings,setSettings]=useState<NeqtaSettings>(initialSettings);

  const products = useMemo(() => rawProducts.map((product) => evaluateProductPricing(product, settings, monthlyOverhead, selectiveCosts, directLaborHourlyCost).product), [rawProducts, settings, monthlyOverhead, selectiveCosts, directLaborHourlyCost]);

  useEffect(()=>{void loadSettingsFromSupabase().then(setSettings);const sync=(event:Event)=>setSettings((event as CustomEvent<NeqtaSettings>).detail);window.addEventListener('neqta-settings-updated',sync);return()=>window.removeEventListener('neqta-settings-updated',sync)},[]);
  useEffect(()=>{void productsService.list().then(rows=>setProducts(rows.filter(product=>product.status!=='recipe')));const sync=(event:Event)=>setProducts(((event as CustomEvent<Product[]>).detail??[]).filter(product=>product.status!=='recipe'));window.addEventListener('neqta-products-updated',sync);return()=>window.removeEventListener('neqta-products-updated',sync)},[]);

  useEffect(() => {
      const corrected = saved.map((promotion) => {
        const product = products.find((item) => item.id === promotion.productId);
        if (!product) return promotion;
        const evaluation = evaluatePromotion(product, promotion, settings.financial.minimumMargin, products);
        return {
          ...promotion,
          marginAfterPromotion: evaluation.margin,
          status: promotion.status === 'ended'
            ? 'ended' as PromotionStatus
            : promotion.status === 'active' && evaluation.valid
              ? 'active' as PromotionStatus
              : evaluation.valid
                ? promotion.status
                : 'unsafe' as PromotionStatus,
        };
      });
      setSaved(corrected);
      if (JSON.stringify(corrected) !== JSON.stringify(saved)) {
        setSaved(corrected);
        void Promise.all(corrected.map((promotion) => promotionsService.save(promotion)));
      }
  }, [products, settings.financial.minimumMargin]);

  const suggestions = useMemo(
    () => opportunitySuggestions(products, settings.financial.minimumMargin)
      .filter((suggestion) => !dismissedSuggestionIds.includes(suggestion.id)),
    [products, settings.financial.minimumMargin, dismissedSuggestionIds],
  );

  const rows = useMemo<PromotionRow[]>(() => [
    ...suggestions,
    ...saved.map((promotion) => {
      const product = products.find((item) => item.id === promotion.productId)!;
      return { ...promotion, product, maxDiscount: product ? safeLimit(product, settings.financial.minimumMargin).maxDiscount : 0 };
    }).filter((row) => row.product),
  ].filter((row) => `${row.product.name} ${typeLabels[row.type]}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
    .filter((row) => filter === 'all'
      ? !row.id.startsWith('neqta-')
      : filter === 'neqta'
        ? row.id.startsWith('neqta-')
        : filter === 'manual'
          ? row.source === 'manual'
          : filter === 'active'
            ? row.status === 'active'
            : row.status === 'ended'),
  [suggestions, saved, products, query, filter, settings.financial.minimumMargin]);

  const opportunities = suggestions.filter((row) => row.discountValue > 0);
  const maxAvailable = Math.round(Math.max(0, ...suggestions.map((row) => row.maxDiscount)));
  const withoutSpace = products.filter((product) => !suggestions.some((row) => row.productId === product.id)).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }

  async function persist(promotion: Promotion) {
    const product = products.find((item) => item.id === promotion.productId);
    if (!product || !evaluatePromotion(product, promotion, settings.financial.minimumMargin, products).valid) {
      notify('Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.');
      return;
    }
    const validated = { ...promotion, status: 'active' as PromotionStatus };
    const next = saved.some((row) => row.id === validated.id)
      ? saved.map((row) => row.id === validated.id ? validated : row)
      : [validated, ...saved];
    setSaved(next);
    await promotionsService.save(validated);
    if (validated.source === 'neqta') {
      const appliedSuggestion = suggestions.find((suggestion) =>
        suggestion.productId === validated.productId
        && suggestion.type === validated.type
        && suggestion.secondaryProductId === validated.secondaryProductId
        && Math.abs(suggestion.promotionalPrice - validated.promotionalPrice) < 0.01,
      );
      if (appliedSuggestion) {
        await promotionDismissalsService.save({ id: appliedSuggestion.id, dismissedAt: new Date().toISOString() });
        setDismissedSuggestionIds((current) => [...new Set([...current, appliedSuggestion.id])]);
      }
    }
    setEditing(null);
    notify('Promoção salva com sucesso.');
  }

  function update(promotion: Promotion) {
    const next = saved.map((row) => row.id === promotion.id ? promotion : row);
    setSaved(next);
    void promotionsService.save(promotion);
    setMenu(null);
  }

  function duplicate(promotion: Promotion) {
    const product = products.find((item) => item.id === promotion.productId);
    if (!product || !evaluatePromotion(product, promotion, settings.financial.minimumMargin, products).valid) {
      setMenu(null);
      notify('Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.');
      return;
    }
    const copy: Promotion = {
      id: `promo-${Date.now()}`,
      productId: promotion.productId,
      type: promotion.type,
      discountValue: promotion.discountValue,
      promotionalPrice: promotion.promotionalPrice,
      marginAfterPromotion: promotion.marginAfterPromotion,
      channels: [...promotion.channels],
      source: promotion.source,
      status: 'active',
      createdAt: new Date().toISOString(),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
    };
    const next = [copy, ...saved];
    setSaved(next);
    void promotionsService.save(copy);
    setMenu(null);
    notify('Promoção duplicada.');
  }

  async function remove(promotion: Promotion) {
    try {
      await promotionsService.remove(promotion.id);
      setSaved((current) => current.filter((row) => row.id !== promotion.id));
      setDeleting(null);
      setMenu(null);
      notify('Promoção excluída.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível excluir a promoção.');
    }
  }

  async function dismissSuggestion(promotion: Promotion) {
    try {
      await promotionDismissalsService.save({
        id: promotion.id,
        dismissedAt: new Date().toISOString(),
      });
      setDismissedSuggestionIds((current) => [...new Set([...current, promotion.id])]);
      setMenu(null);
      notify('Sugestão dispensada.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível dispensar a sugestão.');
    }
  }

  return (
    <section className="promotions-page">
      <header className="promotions-heading">
        <div><h1>Promoções</h1><p>Crie ofertas sem comprometer sua margem.</p></div>
        <div className="promotions-heading-actions"><button className={buttonClass('secondary')} onClick={() => setFilter('neqta')}><Sparkles />Ver sugestões</button><button className={buttonClass('primary')} onClick={() => setPicker(true)}><Plus />Nova promoção</button></div>
      </header>

      <section className="card promotions-xray">
        <div><h2>Oportunidades NEQTA</h2><p>Veja onde existe espaço seguro para criar ofertas.</p></div>
        <div>
          <button onClick={() => setFilter('neqta')}><b>{opportunities.length}</b><span>Oportunidades identificadas</span></button>
          <button onClick={() => setFilter('neqta')}><b>{maxAvailable}%</b><span>Maior desconto disponível</span></button>
          <button onClick={() => setFilter('neqta')}><b>{withoutSpace}</b><span>Sem espaço para promoção</span></button>
        </div>
      </section>

      <section className="promotions-toolbar">
        <label className="product-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou promoção..." /></label>
        <div className="filter-scroll">
          {([['all', 'Todas'], ['neqta', 'Sugeridas pela NEQTA'], ['manual', 'Criadas por mim'], ['active', 'Ativas'], ['ended', 'Encerradas']] as [Filter, string][]).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </section>

      <PromotionTable rows={rows} simulate={(row) => setEditing({ product: row.product, promotion: row, source: row.source })} menu={menu} setMenu={setMenu} update={update} duplicate={duplicate} remove={(row) => { setDeleting(row); setMenu(null); }} dismissSuggestion={dismissSuggestion} />
      <PromotionCards rows={rows} open={(row) => setEditing({ product: row.product, promotion: row, source: row.source })} />

      {picker && <PromotionPicker products={products} minimumMargin={settings.financial.minimumMargin} close={() => setPicker(false)} choose={(product) => { setPicker(false); setEditing({ product, source: 'manual' }); }} />}
      {editing && <PromotionDrawer product={editing.product} products={products} settings={settings} initial={editing.promotion} source={editing.source} close={() => setEditing(null)} save={persist} />}
      {deleting && <PromotionDeleteConfirm promotion={deleting} product={products.find((item) => item.id === deleting.productId)} close={() => setDeleting(null)} confirm={() => void remove(deleting)} />}
      {toast && <div className="app-toast"><span><Check />{toast}</span><button onClick={() => setToast('')} aria-label="Fechar"><X /></button></div>}
    </section>
  );
}

function PromotionDeleteConfirm({ promotion, product, close, confirm }: { promotion: Promotion; product?: Product; close: () => void; confirm: () => void }) {
  const label = promotion.type === 'percentage' ? `${promotion.discountValue}% OFF` : typeLabels[promotion.type];
  return <div className="confirm-layer" role="presentation" onMouseDown={close}><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="promotion-delete-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="promotion-delete-title">Excluir promoção?</h2><p>A promoção {label} de <b>{product?.name ?? 'este produto'}</b> será removida definitivamente.</p><div><button className={buttonClass('ghost')} onClick={close}>Cancelar</button><button className="delete-button" onClick={confirm}>Excluir promoção</button></div></div></div>;
}

function PromotionTable({ rows, simulate, menu, setMenu, update, duplicate, remove, dismissSuggestion }: {
  rows: PromotionRow[];
  simulate: (row: PromotionRow) => void;
  menu: string | null;
  setMenu: (value: string | null) => void;
  update: (promotion: Promotion) => void;
  duplicate: (promotion: Promotion) => void;
  remove: (promotion: Promotion) => void;
  dismissSuggestion: (promotion: Promotion) => void;
}) {
  return <section className="card promotions-table-wrap"><table className="promotions-table"><thead><tr><th>Produto</th><th>Preço atual</th><th>Promoção</th><th>Preço promocional</th><th>Margem após promoção</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map((row) => { const isSuggestion = row.id.startsWith('neqta-'); return <tr key={row.id} onClick={() => simulate(row)}><td><b>{row.product.name}</b><small>{row.product.category}</small></td><td>{money(row.product.currentPrice)}</td><td>{row.discountValue ? row.type === 'percentage' ? `${row.discountValue}% OFF` : typeLabels[row.type] : 'Sem desconto sugerido'}</td><td>{row.discountValue ? money(row.promotionalPrice) : '—'}</td><td>{row.discountValue ? formatPercent(row.marginAfterPromotion) : '—'}</td><td><span className={`promotion-origin ${row.source}`}>{sourceLabel(row.source)}</span></td><td><PromotionStatusBadge status={row.status} /></td><td className="promotion-actions" onClick={(event) => event.stopPropagation()}><button onClick={() => setMenu(menu === row.id ? null : row.id)} aria-label={`Ações de ${row.product.name}`}><MoreHorizontal /></button>{menu === row.id && <div className="action-menu"><button onClick={() => simulate(row)}>{isSuggestion ? 'Simular' : 'Editar'}</button>{isSuggestion && row.discountValue > 0 && <button onClick={() => simulate(row)}>Usar promoção</button>}{isSuggestion && <button className="danger-action" onClick={() => void dismissSuggestion(row)}>Dispensar sugestão</button>}{!isSuggestion && <><button onClick={() => duplicate(row)}>Duplicar</button>{row.status !== 'ended' && <button onClick={() => update({ ...row, status: 'ended' })}>Encerrar</button>}<button className="danger-action" onClick={() => void remove(row)}>Excluir</button></>}</div>}</td></tr>; })}</tbody></table></section>;
}

function PromotionCards({ rows, open }: { rows: PromotionRow[]; open: (row: PromotionRow) => void }) {
  return <section className="promotion-cards">{rows.map((row) => <article className="card promotion-card" key={row.id}><header><div><h2>{row.product.name}</h2><p>{sourceLabel(row.source)}</p></div><PromotionStatusBadge status={row.status} /></header><div><span>Preço atual<b>{money(row.product.currentPrice)}</b></span><span>Promoção<b>{row.discountValue ? row.type === 'percentage' ? `${row.discountValue}% OFF` : typeLabels[row.type] : '—'}</b></span><span>Preço promocional<b>{row.discountValue ? money(row.promotionalPrice) : '—'}</b></span><span>Margem após promoção<b>{row.discountValue ? formatPercent(row.marginAfterPromotion) : '—'}</b></span></div><button className="action-row" onClick={() => open(row)}>Ver promoção<ArrowRight /></button></article>)}</section>;
}

function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return <span className={`promotion-status ${status}`}>{statusLabels[status]}</span>;
}

function PromotionPicker({ products, minimumMargin, close, choose }: { products: Product[]; minimumMargin:number; close: () => void; choose: (product: Product) => void }) {
  const [query, setQuery] = useState('');
  const sorted = products.filter((product) => product.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a, b) => safeLimit(b,minimumMargin).maxDiscount - safeLimit(a,minimumMargin).maxDiscount);
  return createPortal(<div className="product-overlay promotion-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="product-drawer promotion-picker" role="dialog" aria-modal="true" aria-label="Escolher produto para promoção"><header><div><h2>Nova promoção</h2><p>Escolha um produto para criar uma promoção.</p></div><button onClick={close} aria-label="Fechar"><X /></button></header><div className="product-drawer-content"><label className="product-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto..." autoFocus /></label><div className="promotion-picker-list">{sorted.map((product) => { const limit = safeLimit(product,minimumMargin); return <button key={product.id} onClick={() => choose(product)}><span><b>{product.name}</b><small>{product.category}</small></span><span><small>Preço atual</small><b>{money(product.currentPrice)}</b></span><span><small>Margem atual</small><b>{formatPercent(product.projectedMargin)}</b></span><span><small>Limite seguro</small><b>{limit.maxDiscount >= 1 ? `até ${limit.maxDiscount.toFixed(1).replace('.', ',')}% OFF` : 'Sem margem disponível'}</b></span><ArrowRight /></button>; })}</div></div></section></div>, document.body);
}

function PromotionDrawer({ product, products, settings, initial, source, close, save }: { product: Product; products: Product[]; settings:NeqtaSettings; initial?: Promotion; source: PromotionSource; close: () => void; save: (promotion: Promotion) => void }) {
  const minimumMargin=settings.financial.minimumMargin;
  const limit = safeLimit(product,minimumMargin);
  const suggestionDiscount = commercialDiscount(limit.maxDiscount);
  const suggestionPrice = product.currentPrice * (1 - suggestionDiscount / 100);
  const suggestionMargin = evaluatePromotionScenario(product, suggestionPrice, minimumMargin).margin;
  const [type, setType] = useState<PromotionType>(initial?.type ?? 'percentage');
  const [value, setValue] = useState(() => {
    if (!initial) return 0;
    if (initial.type === 'price' || initial.type === 'combo') return initial.promotionalPrice;
    if (initial.type === 'take2') return initial.promotionalPrice * 2;
    if (initial.type === 'fixed') return Math.max(0, product.currentPrice - initial.promotionalPrice);
    return initial.discountValue;
  });
  const [secondaryProductId, setSecondaryProductId] = useState(initial?.secondaryProductId ?? '');
  const [selectedChannels, setChannels] = useState(initial?.channels?.length ? initial.channels : ['store']);
  const [startDate, setStart] = useState(initial?.startDate ?? '');
  const [endDate, setEnd] = useState(initial?.endDate ?? '');

  const secondaryProduct = type === 'combo' ? products.find((item) => item.id === secondaryProductId) : undefined;
  const referencePrice = product.currentPrice + (secondaryProduct?.currentPrice ?? 0);
  const activeLimit = promotionSafeLimit(product, minimumMargin, secondaryProduct);

  let promotionalPrice = type === 'percentage'
    ? referencePrice * (1 - value / 100)
    : type === 'fixed'
      ? referencePrice - value
      : type === 'take2'
        ? value / 2
        : value;
  promotionalPrice = Math.max(0, promotionalPrice);

  const evaluation = evaluatePromotionScenario(product, promotionalPrice, minimumMargin, secondaryProduct);
  const { consideredCost, equivalentDiscount, margin, contribution } = evaluation;
  const noSpace = activeLimit.maxDiscount < 1;
  const dateValid = !startDate || !endDate || endDate >= startDate;
  const availableChannels=settings.channels.filter(channel=>channel.active);
  const activePayments=settings.payments.filter(payment=>payment.active);
  const fallbackPayment=activePayments.sort((a,b)=>(b.percentageFee+b.anticipationFee)-(a.percentageFee+a.anticipationFee)||b.fixedFee-a.fixedFee)[0];
  const channelRows = availableChannels.filter((channel) => selectedChannels.includes(channel.id)).map((channel) => {
    const paymentFee=channel.processesPayment?0:(fallbackPayment?.percentageFee??0)+(fallbackPayment?.anticipationFee??0);
    const paymentFixedFee=channel.processesPayment?0:(fallbackPayment?.fixedFee??0);
    const fee=channel.percentageFee+paymentFee;
    return { ...channel, fee, price: promotionalPrice, margin: evaluation.dataReady ? marginForChannel(promotionalPrice, consideredCost, evaluation.percentageFees + fee,channel.fixedFee+paymentFixedFee) ?? 0 : 0 };
  });
  const channelsValid=channelRows.every((channel)=>channel.margin>=minimumMargin);
  const financiallyValid=evaluation.valid&&channelsValid&&equivalentDiscount<=activeLimit.maxDiscount+0.001;
  const status=!evaluation.dataReady||!channelsValid?'unsafe':promotionStatus(margin,minimumMargin);
  const valid = !noSpace && promotionalPrice > 0 && equivalentDiscount > 0 && financiallyValid && selectedChannels.length > 0 && dateValid && (type !== 'combo' || !!secondaryProduct);

  function toggleChannel(id: string) {
    setChannels((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return [...current, id];
    });
  }

  function applySuggestion() {
    setType('percentage');
    setValue(suggestionDiscount);
  }

  return createPortal(<div className="product-overlay promotion-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="product-drawer promotion-drawer" role="dialog" aria-modal="true" aria-label="Criar promoção"><header><div><h2>Criar promoção</h2><p>{product.name} · {product.category}</p></div><button onClick={close} aria-label="Fechar"><X /></button></header><div className="product-drawer-content promotion-drawer-content">
    <section className="promotion-current"><span>Custo efetivo<b>{money(product.pricingEffectiveCost ?? product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span><span>Margem operacional estimada<b>{formatPercent(product.projectedMargin)}</b></span><span>Margem mínima configurada<b>{formatPercent(minimumMargin)}</b></span></section>
    {noSpace && <section className="promotion-alert"><b>{(product.pricingCompleteness ?? 0) < 100 ? 'Complete a ficha técnica antes de criar uma promoção.' : 'Este produto não possui margem disponível para desconto.'}</b><p>{(product.pricingCompleteness ?? 0) < 100 ? 'A NEQTA não sugere descontos enquanto os custos não forem confiáveis.' : 'Revise o preço antes de criar uma promoção.'}</p><Link href={(product.pricingCompleteness ?? 0) < 100 ? routes.product(product.id) : routes.pricingProduct(product.id)}>{(product.pricingCompleteness ?? 0) < 100 ? 'Revisar ficha técnica' : 'Ir para Precificação'}</Link></section>}
    {!noSpace && suggestionDiscount > 0 && <section className="promotion-suggestion"><div><small>Sugestão NEQTA</small><strong>{suggestionDiscount}% OFF</strong><span>{money(product.currentPrice)} <ArrowRight /> {money(suggestionPrice)}</span><p>Margem após promoção: <b>{formatPercent(suggestionMargin)}</b></p></div><button className={`${buttonClass('ghost')} promotion-apply-suggestion`} onClick={applySuggestion}>Aplicar sugestão</button></section>}
    {!noSpace && <><section className="promotion-builder"><h3>Simular promoção</h3><label>Tipo de promoção<CustomSelect value={type} onChange={(next) => { const nextType = next as PromotionType; setType(nextType); setValue(0); if (nextType !== 'combo') setSecondaryProductId(''); }} ariaLabel="Tipo de promoção" options={(Object.keys(typeLabels) as PromotionType[]).map((key) => ({ value: key, label: typeLabels[key] }))} /></label>{type === 'combo' && <label>Produto adicional<CustomSelect value={secondaryProductId} onChange={setSecondaryProductId} ariaLabel="Produto adicional do combo" placeholder="Selecione um produto..." options={products.filter((item) => item.id !== product.id).map((item) => ({ value: item.id, label: `${item.name} · ${money(item.currentPrice)}` }))} /><small>O produto principal ({product.name}) já faz parte do combo. A lista mostra todos os outros produtos disponíveis.</small></label>}<label>{type === 'percentage' ? 'Desconto (%)' : type === 'fixed' ? 'Desconto (R$)' : type === 'take2' ? 'Preço total para 2 unidades' : type === 'combo' ? 'Preço do combo' : 'Preço promocional'}<input inputMode="decimal" value={type === 'percentage' ? value || '' : value ? money(value) : ''} onChange={(event) => setValue(type === 'percentage' ? parsePercent(event.target.value) : parseBRL(event.target.value))} /></label>
      <div className="promotion-result"><span className="promotion-result-primary">Preço promocional<b>{money(promotionalPrice)}</b></span><span className="promotion-result-primary">Margem após promoção<b>{formatPercent(margin)}</b></span><span>Desconto<b>{formatPercent(equivalentDiscount)}</b></span><span>Desconto máximo seguro<b>{formatPercent(activeLimit.maxDiscount)}</b></span><span>Contribuição estimada por unidade<b>{money(Math.max(0, contribution))}</b></span><span>Classificação<PromotionStatusBadge status={status} /></span></div>
      {!financiallyValid && equivalentDiscount > 0 && <p className="promotion-limit-warning">Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.</p>}
    </section>
    <section className="promotion-channels"><h3>Canais da promoção</h3><p>Escolha onde esta oferta será aplicada.</p><div className="channel-toggles" role="group" aria-label="Canais da promoção"><button className={selectedChannels.length === availableChannels.length ? 'active' : ''} aria-pressed={selectedChannels.length === availableChannels.length} onClick={() => setChannels(availableChannels.map((channel) => channel.id))}>Todos os canais</button>{availableChannels.map((channel) => <button key={channel.id} className={selectedChannels.includes(channel.id) ? 'active' : ''} aria-pressed={selectedChannels.includes(channel.id)} onClick={() => toggleChannel(channel.id)}>{channel.name}</button>)}</div><h3 className="channel-impact-title">Impacto financeiro por canal</h3><div className="promotion-channel-list">{channelRows.map((channel) => <article key={channel.id}><span><b>{channel.name}</b><small>{channel.fee ? `Taxas ${channel.fee}%` : 'Sem taxa'}</small></span><span><small>Preço promocional</small><b>{money(channel.price)}</b></span><span><small>Margem projetada</small><b>{formatPercent(channel.margin)}</b></span></article>)}</div></section>
    <section className="promotion-dates"><h3>Período da promoção</h3><label>Início <small>Opcional</small><input type="date" value={startDate} onChange={(event) => setStart(event.target.value)} /></label><label>Término <small>Opcional</small><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEnd(event.target.value)} /></label>{!dateValid && <p>A data de término não pode ser anterior à data de início.</p>}</section></>}
  </div><footer className={`promotion-drawer-footer${noSpace ? ' no-promotion-footer' : ''}`}><button className={buttonClass('ghost')} onClick={close}>Cancelar</button>{!noSpace && <button className={buttonClass('primary')} disabled={!valid} onClick={() => save({ id: initial?.source === 'manual' ? initial.id : `promo-${Date.now()}`, productId: product.id, secondaryProductId: type === 'combo' ? secondaryProductId : undefined, type, discountValue: type === 'percentage' ? value : equivalentDiscount, promotionalPrice, marginAfterPromotion: margin, channels: selectedChannels, source, status: 'active', createdAt: initial?.createdAt ?? new Date().toISOString(), startDate: startDate || undefined, endDate: endDate || undefined })}>Salvar promoção</button>}</footer></section></div>, document.body);
}
