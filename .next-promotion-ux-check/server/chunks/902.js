"use strict";exports.id=902,exports.ids=[902],exports.modules={42445:(a,b,c)=>{c.d(b,{DZ:()=>j,L6:()=>g,M5:()=>h,W7:()=>i});var d=c(34866),e=c(2192);let f=null,g={company:{name:"Burger House",segment:"Restaurante",cnpj:"",taxRegime:"",operatingDays:30},financial:{targetMargin:30,minimumMargin:25,estimatedMonthlyRevenue:0,salesTax:0},channels:[{id:"store",name:"Loja / Balc\xe3o",type:"Loja f\xedsica",percentageFee:0,fixedFee:0,processesPayment:!1,active:!0},{id:"whatsapp",name:"WhatsApp",type:"Venda direta",percentageFee:0,fixedFee:0,processesPayment:!1,active:!1},{id:"delivery",name:"Delivery pr\xf3prio",type:"Delivery",percentageFee:0,fixedFee:0,processesPayment:!1,active:!1},{id:"ifood",name:"iFood",type:"Marketplace",percentageFee:23,fixedFee:0,processesPayment:!0,active:!0},{id:"99",name:"99",type:"Marketplace",percentageFee:14,fixedFee:0,processesPayment:!0,active:!0}],payments:[{id:"pix",name:"PIX",percentageFee:0,fixedFee:0,anticipationFee:0,active:!0},{id:"cash",name:"Dinheiro",percentageFee:0,fixedFee:0,anticipationFee:0,active:!0},{id:"debit",name:"D\xe9bito",percentageFee:1.49,fixedFee:0,anticipationFee:0,active:!0},{id:"credit",name:"Cr\xe9dito",percentageFee:3.49,fixedFee:0,anticipationFee:0,active:!0},{id:"online",name:"Pagamento online",percentageFee:4.29,fixedFee:0,anticipationFee:0,active:!0}],preferences:{theme:"dark",rounding:"x90",massUnit:"kg",volumeUnit:"L",itemUnit:"un",alerts:{costIncrease:!0,belowMinimumMargin:!0,safePromotion:!0}}};function h(){return f??g}async function i(){try{let a=await (0,e.X4)("settings",g),b={...g.company,...a.company},c={...g.financial,...a.financial};return f={...g,...a,company:{...b,cnpj:(0,d.Jj)(b.cnpj),operatingDays:(0,d.o5)(b.operatingDays,1,31)},financial:{...c,targetMargin:(0,d.tb)(c.targetMargin),minimumMargin:(0,d.tb)(c.minimumMargin),estimatedMonthlyRevenue:(0,d.up)(c.estimatedMonthlyRevenue),salesTax:(0,d.tb)(c.salesTax)},channels:(a.channels?.length?a.channels:g.channels).map(a=>({...a,percentageFee:(0,d.tb)(a.percentageFee),fixedFee:(0,d.up)(a.fixedFee)})),payments:(a.payments?.length?a.payments:g.payments).map(a=>({...a,percentageFee:(0,d.tb)(a.percentageFee),fixedFee:(0,d.up)(a.fixedFee),anticipationFee:(0,d.tb)(a.anticipationFee)})),preferences:{...g.preferences,...a.preferences,alerts:{...g.preferences.alerts,...a.preferences?.alerts}}}}catch{return f??g}}async function j(a){let b={...a,company:{...a.company,name:(0,d.F4)(a.company.name),segment:(0,d.F4)(a.company.segment),cnpj:(0,d.Jj)(a.company.cnpj),taxRegime:(0,d.F4)(a.company.taxRegime),operatingDays:(0,d.o5)(a.company.operatingDays,1,31)},financial:{...a.financial,targetMargin:(0,d.tb)(a.financial.targetMargin),minimumMargin:(0,d.tb)(a.financial.minimumMargin),estimatedMonthlyRevenue:Math.max(0,(0,d.up)(a.financial.estimatedMonthlyRevenue)),salesTax:(0,d.tb)(a.financial.salesTax)},channels:a.channels.map(a=>({...a,name:(0,d.F4)(a.name),percentageFee:(0,d.tb)(a.percentageFee),fixedFee:Math.max(0,(0,d.up)(a.fixedFee))})),payments:a.payments.map(a=>({...a,name:(0,d.F4)(a.name),percentageFee:(0,d.tb)(a.percentageFee),fixedFee:Math.max(0,(0,d.up)(a.fixedFee)),anticipationFee:(0,d.tb)(a.anticipationFee)}))};f=b,await (0,e.ip)("settings",b),window.dispatchEvent(new CustomEvent("neqta-settings-updated",{detail:b}))}},46689:(a,b,c)=>{c.d(b,{t:()=>e});var d=c(42356);function e(a,b,c){let e=new d.A(a||0),f=new d.A(c||0);return"g"===b||"ml"===b?e.div(1e3).mul(f).toDecimalPlaces(2).toNumber():"d\xfazia"===b?e.div(12).mul(f).toDecimalPlaces(2).toNumber():e.mul(f).toDecimalPlaces(2).toNumber()}},58730:(a,b,c)=>{c.d(b,{W:()=>t});var d=c(72326),e=c(37474),f=c(46689);let g=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function h(a){if(null==a)return 0;let b=Number(a);return Number.isFinite(b)?b:0}function i(a,b){return a<=0?"warning":a<.75*b?"critical":a<b?"warning":"healthy"}function j(a){return JSON.stringify({version:1,description:a.description??"",variableCost:a.variableCost??0,targetMargin:a.targetMargin??0,recommendedPrice:a.recommendedPrice??a.currentPrice??0,components:a.components??[],packaging:a.packaging??[]})}function k(a){return(a??[]).reduce((a,b)=>a+h(b.quantity)*h(b.unitCost),0)}function l(a){return a.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR")}function m(a,b){if(a.id===b.id)return!0;let c=l(a.name),d=l(b.name);return c===d||c.length>=5&&d.length>=5&&(c.includes(d)||d.includes(c))}async function n(a,b){let{data:c,error:d}=await a.from("neqta_records").select("record_key,data").eq("store_id",b).eq("namespace","cost-items");if(d)throw Error(`Erro ao carregar custos dos produtos: ${d.message}`);return(c??[]).map(a=>({...a.data,id:a.record_key}))}function o(a,b){let c=(a.components??[]).map(a=>{let c=b.find(b=>"ingredient"===b.type&&m(a,b));return c?{...a,id:c.id,name:c.name,unitCost:"g"===c.purchaseUnit||"ml"===c.purchaseUnit?1e3*c.baseUnitCost:c.baseUnitCost}:a}),d=(a.packaging??[]).map(a=>{let c=b.find(b=>"packaging"===b.type&&m(a,b));return c?{...a,id:c.id,name:c.name,unitCost:c.baseUnitCost}:a}),e=c.reduce((a,b)=>a+(0,f.t)(b.quantity,b.unit,b.unitCost),0)+k(d),g=a.currentPrice>0?(a.currentPrice-e)/a.currentPrice*100:0,h=a.targetMargin<100?e/(1-a.targetMargin/100):a.currentPrice;return{...a,components:c,packaging:d,variableCost:e,projectedMargin:g,recommendedPrice:h,status:i(g,a.targetMargin)}}function p(a){var b;let c=h(a.sale_price),d=function(a){if(!a)return{};try{let b=JSON.parse(a);return 1===b.version?b:{description:a}}catch{return{description:a}}}(a.description),e=Array.isArray(d.packaging)?d.packaging:[],f=d.variableCost??0,g=d.targetMargin??0,j=c>0?(c-f)/c*100:0,k=d.recommendedPrice??c;return{id:a.id,name:a.name,category:(b=a.product_categories)?Array.isArray(b)?b[0]?.name??"":b.name??"":"",variableCost:f,currentPrice:c,projectedMargin:j,targetMargin:g,recommendedPrice:k,status:i(j,g),kind:"product",yield:a.yield_quantity&&a.yield_unit?`${h(a.yield_quantity)} ${a.yield_unit}`:void 0,yieldQuantity:null!==a.yield_quantity?h(a.yield_quantity):void 0,yieldUnit:a.yield_unit??void 0,componentCount:d.components?.length??0,description:d.description??"",components:d.components??[],packaging:e}}async function q(a){let b=await (0,e.n)(a);if(!b)throw Error("N\xe3o foi poss\xedvel identificar o contexto atual do usu\xe1rio.");if(!b.store)throw Error("N\xe3o foi poss\xedvel identificar a loja atual.");return b.store.id}async function r(a,b){let c=a?.trim();if(!c)return null;let e=(0,d.U)(),{data:f,error:g}=await e.from("product_categories").select("id").eq("store_id",b).ilike("name",c).limit(1).maybeSingle();if(g)throw Error(`Erro ao localizar categoria: ${g.message}`);if(f?.id)return f.id;let{data:h,error:i}=await e.from("product_categories").insert({store_id:b,name:c}).select("id").single();if(i)throw Error(`Erro ao criar categoria: ${i.message}`);return h.id}async function s(a){let b=(0,d.U)(),c=await q(b),{data:e,error:f}=await b.from("products").select(`
      id,
      store_id,
      category_id,
      name,
      sku,
      description,
      sale_price,
      packaging_cost,
      is_base,
      yield_quantity,
      yield_unit,
      active,
      created_at,
      updated_at,
      product_categories (
        id,
        name
      )
    `).eq("id",a).eq("store_id",c).eq("active",!0).maybeSingle();if(f)throw Error(`Erro ao carregar produto: ${f.message}`);return e}let t={async list(a){let b=a??(0,d.U)(),c=await q(b),{data:e,error:f}=await b.from("products").select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).eq("store_id",c).eq("active",!0).order("name",{ascending:!0});if(f)throw Error(`Erro ao carregar produtos: ${f.message}`);let g=await n(b,c);return e.map(p).map(a=>o(a,g))},async getById(a){let b=await s(a);if(!b)return null;let c=(0,d.U)(),e=await q(c);return o(p(b),await n(c,e))},async create(a){let b=(0,d.U)(),c=await q(b),e=await r(a.category,c),{data:f,error:g}=await b.from("products").insert({store_id:c,category_id:e,name:a.name.trim(),description:j(a),sale_price:a.currentPrice,packaging_cost:k(a.packaging),is_base:!1,active:!0}).select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).single();if(g)throw Error(`Erro ao criar produto: ${g.message}`);return p(f)},async update(a,b){let c=(0,d.U)(),e=await q(c),f={},g=await s(a);if(!g)throw Error("Produto n\xe3o encontrado.");let h=p(g),i={name:b.name??h.name,category:b.category??h.category,currentPrice:b.currentPrice??h.currentPrice,targetMargin:b.targetMargin??h.targetMargin,kind:b.kind??h.kind,description:b.description??h.description,variableCost:b.variableCost??h.variableCost,recommendedPrice:b.recommendedPrice??h.recommendedPrice,components:b.components??h.components,packaging:b.packaging??h.packaging};void 0!==b.name&&(f.name=b.name.trim()),void 0!==b.currentPrice&&(f.sale_price=b.currentPrice),void 0!==b.category&&(f.category_id=await r(b.category,e)),(void 0!==b.description||void 0!==b.variableCost||void 0!==b.targetMargin||void 0!==b.recommendedPrice||void 0!==b.components||void 0!==b.packaging)&&(f.description=j(i)),void 0!==b.packaging&&(f.packaging_cost=k(i.packaging));let{data:l,error:m}=await c.from("products").update(f).eq("id",a).eq("store_id",e).select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).maybeSingle();if(m)throw Error(`Erro ao atualizar produto: ${m.message}`);if(!l)throw Error("Produto n\xe3o encontrado.");return p(l)},async save(a){return g.test(a.id)&&await this.getById(a.id)?this.update(a.id,{name:a.name,category:a.category,currentPrice:a.currentPrice,targetMargin:a.targetMargin,kind:a.kind,description:a.description,variableCost:a.variableCost,recommendedPrice:a.recommendedPrice,components:a.components,packaging:a.packaging}):this.create({name:a.name,category:a.category,currentPrice:a.currentPrice,targetMargin:a.targetMargin,kind:a.kind,description:a.description,variableCost:a.variableCost,recommendedPrice:a.recommendedPrice,components:a.components,packaging:a.packaging})},async remove(a){let b=(0,d.U)(),c=await q(b),{error:e}=await b.from("products").update({active:!1}).eq("id",a).eq("store_id",c);if(e)throw Error(`Erro ao remover produto: ${e.message}`)}}}};