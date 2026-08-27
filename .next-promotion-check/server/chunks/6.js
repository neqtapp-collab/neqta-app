"use strict";exports.id=6,exports.ids=[6],exports.modules={2192:(a,b,c)=>{c.d(b,{Sb:()=>g,X4:()=>h,ip:()=>i});var d=c(72326),e=c(37474);async function f(a){let b=a??(0,d.U)(),c=await (0,e.n)(b);if(!c?.store)throw Error("N\xe3o foi poss\xedvel identificar a loja atual.");return{supabase:b,storeId:c.store.id}}function g(a){return{async list(b){let{supabase:c,storeId:d}=await f(b),{data:e,error:g}=await c.from("neqta_records").select("record_key,data").eq("store_id",d).eq("namespace",a).order("created_at");if(g)throw Error(`Erro ao carregar ${a}: ${g.message}`);return(e??[]).map(a=>({...a.data,id:a.record_key}))},async save(b){let{supabase:c,storeId:d}=await f(),{error:e}=await c.from("neqta_records").upsert({store_id:d,namespace:a,record_key:b.id,data:b,updated_at:new Date().toISOString()},{onConflict:"store_id,namespace,record_key"});if(e)throw Error(`Erro ao salvar ${a}: ${e.message}`);return structuredClone(b)},async replaceAll(a){let b=await this.list();return await Promise.all(a.map(a=>this.save(a))),await Promise.all(b.filter(b=>!a.some(a=>a.id===b.id)).map(a=>this.remove(a.id))),structuredClone(a)},async remove(b){let{supabase:c,storeId:d}=await f(),{error:e}=await c.from("neqta_records").delete().eq("store_id",d).eq("namespace",a).eq("record_key",b);if(e)throw Error(`Erro ao remover ${a}: ${e.message}`)}}}async function h(a,b){let c=await g(a).list();return c[0]?.value??structuredClone(b)}async function i(a,b){return await g(a).save({id:"current",value:b}),structuredClone(b)}},29813:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(64686).A)("search",[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]])},34866:(a,b,c)=>{function d(a,b){let c=String(a??"").replace(/\D/g,"");return"number"==typeof b?c.slice(0,b):c}function e(a){return d(a,14)}function f(a){return e(a).replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2")}function g(a){let b=e(a);if(14!==b.length||/^(\d)\1{13}$/.test(b))return!1;let c=a=>{let c=a-7,d=0;for(let e=0;e<a;e+=1)d+=Number(b[e])*c--,c<2&&(c=9);let e=d%11;return e<2?0:11-e};return c(12)===Number(b[12])&&c(13)===Number(b[13])}function h(a,b=3,c){let[d="",e=""]=String(a??"").replace(/[^\d,.]/g,"").replace(",",".").split("."),f=Number(`${d.replace(/^0+(?=\d)/,"")||"0"}${e?`.${e.slice(0,b)}`:""}`);return!Number.isFinite(f)||f<0?0:"number"==typeof c?Math.min(f,c):f}function i(a){return h(a,2,100)}function j(a,b=0,c=Number.MAX_SAFE_INTEGER){let e=Number(d(a));return Number.isFinite(e)?Math.min(Math.max(e,b),c):b}function k(a,b=80){return String(a??"").trim().replace(/\s+/g," ").slice(0,b)}function l(a,b=0){if("number"==typeof a)return Number.isFinite(a)?a:b;let c=String(a??"").replace(/[^\d,.-]/g,""),d=Number(c.includes(",")?c.replace(/\./g,"").replace(",","."):c);return Number.isFinite(d)?d:b}c.d(b,{$t:()=>f,F4:()=>k,Jj:()=>e,o5:()=>j,tS:()=>h,tb:()=>i,up:()=>l,yU:()=>g})},35790:(a,b,c)=>{c.d(b,{AppShell:()=>d});let d=(0,c(77943).registerClientReference)(function(){throw Error("Attempted to call AppShell() from the server but AppShell is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"C:\\Users\\diogo\\Downloads\\NEQTA\\SITE\\neqta-v1\\components\\AppShell.tsx","AppShell")},41596:(a,b,c)=>{c.d(b,{U:()=>e});var d=c(97282);function e(){return(0,d.k)("https://mygmjfrileywjswonxeb.supabase.co","sb_publishable_kIf0bCTuOHN0dOiVNVv4AQ_rhOM_zn4")}},51337:(a,b,c)=>{c.d(b,{$H:()=>f,M9:()=>m,TG:()=>o,Yd:()=>g,ZS:()=>l,Zx:()=>n,l9:()=>i,lo:()=>h,pL:()=>j,qe:()=>k});var d=c(42356),e=c(34866);function f(a,b){return a>0?new d.A(a).minus(b).div(a).mul(100).toNumber():0}function g(a){let b=a.replace(/\D/g,"");return b?new d.A(b).div(100).toNumber():0}function h(a){return(0,e.tb)(a)}function i(a){let b=(0,e.tb)(a),c=!Number.isInteger(b);return`${b.toLocaleString("pt-BR",{minimumFractionDigits:2*!!c,maximumFractionDigits:2})}%`}function j(a,b,c=0,e=0){let f=new d.A(1).minus(new d.A(b).div(100)).minus(new d.A(c).div(100));return f.lte(0)?0:new d.A(a).plus(e).div(f).toDecimalPlaces(2).toNumber()}function k(a,b,c=0,e=0){return a<=0?null:new d.A(a).minus(b).minus(new d.A(a).mul(c).div(100)).minus(e).div(a).mul(100).toDecimalPlaces(2).toNumber()}function l(a){return a<=0?0:new d.A(a).ceil().minus(.1).toDecimalPlaces(2).toNumber()}function m(a){return a.reduce((a,b)=>a.plus(b||0),new d.A(0)).toDecimalPlaces(2).toNumber()}function n(a,b){return new d.A(a||0).mul(b||0).toDecimalPlaces(2).toNumber()}function o(a){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(a)}},53212:(a,b,c)=>{c.d(b,{W:()=>t});var d=c(41596),e=c(80240),f=c(61458);let g=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function h(a){if(null==a)return 0;let b=Number(a);return Number.isFinite(b)?b:0}function i(a,b){return a<=0?"warning":a<.75*b?"critical":a<b?"warning":"healthy"}function j(a){return JSON.stringify({version:1,description:a.description??"",variableCost:a.variableCost??0,targetMargin:a.targetMargin??0,recommendedPrice:a.recommendedPrice??a.currentPrice??0,components:a.components??[],packaging:a.packaging??[]})}function k(a){return(a??[]).reduce((a,b)=>a+h(b.quantity)*h(b.unitCost),0)}function l(a){return a.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR")}function m(a,b){if(a.id===b.id)return!0;let c=l(a.name),d=l(b.name);return c===d||c.length>=5&&d.length>=5&&(c.includes(d)||d.includes(c))}async function n(a,b){let{data:c,error:d}=await a.from("neqta_records").select("record_key,data").eq("store_id",b).eq("namespace","cost-items");if(d)throw Error(`Erro ao carregar custos dos produtos: ${d.message}`);return(c??[]).map(a=>({...a.data,id:a.record_key}))}function o(a,b){let c=(a.components??[]).map(a=>{let c=b.find(b=>"ingredient"===b.type&&m(a,b));return c?{...a,id:c.id,name:c.name,unitCost:"g"===c.purchaseUnit||"ml"===c.purchaseUnit?1e3*c.baseUnitCost:c.baseUnitCost}:a}),d=(a.packaging??[]).map(a=>{let c=b.find(b=>"packaging"===b.type&&m(a,b));return c?{...a,id:c.id,name:c.name,unitCost:c.baseUnitCost}:a}),e=c.reduce((a,b)=>{var c,d,e;let g,h;return a+(c=b.quantity,d=b.unit,e=b.unitCost,g=new f.A(c||0),h=new f.A(e||0),"g"===d||"ml"===d?g.div(1e3).mul(h).toDecimalPlaces(2).toNumber():"d\xfazia"===d?g.div(12).mul(h).toDecimalPlaces(2).toNumber():g.mul(h).toDecimalPlaces(2).toNumber())},0)+k(d),g=a.currentPrice>0?(a.currentPrice-e)/a.currentPrice*100:0,h=a.targetMargin<100?e/(1-a.targetMargin/100):a.currentPrice;return{...a,components:c,packaging:d,variableCost:e,projectedMargin:g,recommendedPrice:h,status:i(g,a.targetMargin)}}function p(a){var b;let c=h(a.sale_price),d=function(a){if(!a)return{};try{let b=JSON.parse(a);return 1===b.version?b:{description:a}}catch{return{description:a}}}(a.description),e=Array.isArray(d.packaging)?d.packaging:[],f=d.variableCost??0,g=d.targetMargin??0,j=c>0?(c-f)/c*100:0,k=d.recommendedPrice??c;return{id:a.id,name:a.name,category:(b=a.product_categories)?Array.isArray(b)?b[0]?.name??"":b.name??"":"",variableCost:f,currentPrice:c,projectedMargin:j,targetMargin:g,recommendedPrice:k,status:i(j,g),kind:"product",yield:a.yield_quantity&&a.yield_unit?`${h(a.yield_quantity)} ${a.yield_unit}`:void 0,yieldQuantity:null!==a.yield_quantity?h(a.yield_quantity):void 0,yieldUnit:a.yield_unit??void 0,componentCount:d.components?.length??0,description:d.description??"",components:d.components??[],packaging:e}}async function q(a){let b=await (0,e.n)(a);if(!b)throw Error("N\xe3o foi poss\xedvel identificar o contexto atual do usu\xe1rio.");if(!b.store)throw Error("N\xe3o foi poss\xedvel identificar a loja atual.");return b.store.id}async function r(a,b){let c=a?.trim();if(!c)return null;let e=(0,d.U)(),{data:f,error:g}=await e.from("product_categories").select("id").eq("store_id",b).ilike("name",c).limit(1).maybeSingle();if(g)throw Error(`Erro ao localizar categoria: ${g.message}`);if(f?.id)return f.id;let{data:h,error:i}=await e.from("product_categories").insert({store_id:b,name:c}).select("id").single();if(i)throw Error(`Erro ao criar categoria: ${i.message}`);return h.id}async function s(a){let b=(0,d.U)(),c=await q(b),{data:e,error:f}=await b.from("products").select(`
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
      `).maybeSingle();if(m)throw Error(`Erro ao atualizar produto: ${m.message}`);if(!l)throw Error("Produto n\xe3o encontrado.");return p(l)},async save(a){return g.test(a.id)&&await this.getById(a.id)?this.update(a.id,{name:a.name,category:a.category,currentPrice:a.currentPrice,targetMargin:a.targetMargin,kind:a.kind,description:a.description,variableCost:a.variableCost,recommendedPrice:a.recommendedPrice,components:a.components,packaging:a.packaging}):this.create({name:a.name,category:a.category,currentPrice:a.currentPrice,targetMargin:a.targetMargin,kind:a.kind,description:a.description,variableCost:a.variableCost,recommendedPrice:a.recommendedPrice,components:a.components,packaging:a.packaging})},async remove(a){let b=(0,d.U)(),c=await q(b),{error:e}=await b.from("products").update({active:!1}).eq("id",a).eq("store_id",c);if(e)throw Error(`Erro ao remover produto: ${e.message}`)}}},56785:(a,b,c)=>{function d(a,b=""){return`ui-button ui-button--${a} ${b}`.trim()}c.d(b,{f:()=>d}),c(48249)},60136:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(64686).A)("ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]])},72880:(a,b,c)=>{c.d(b,{U:()=>f});var d=c(76729),e=c(65573);async function f(){let a=await (0,e.UL)();return(0,d.R)("https://mygmjfrileywjswonxeb.supabase.co","sb_publishable_kIf0bCTuOHN0dOiVNVv4AQ_rhOM_zn4",{cookies:{getAll:()=>a.getAll(),setAll(b){try{b.forEach(({name:b,value:c,options:d})=>{a.set(b,c,d)})}catch{}}}})}},80240:(a,b,c)=>{c.d(b,{n:()=>e});var d=c(41596);async function e(a=(0,d.U)()){let{data:{user:b},error:c}=await a.auth.getUser();if(c||!b)return null;let{data:f,error:g}=await a.from("profiles").select("id, full_name, avatar_url").eq("id",b.id).maybeSingle();g&&console.error("Erro ao carregar perfil do usu\xe1rio:",g);let{data:h,error:i}=await a.from("organization_members").select("organization_id, user_id, role, active").eq("user_id",b.id).eq("active",!0).limit(1).maybeSingle();i&&console.error("Erro ao carregar v\xednculo com a organiza\xe7\xe3o:",i);let j=null,k=null;if(h?.organization_id){let{data:b,error:c}=await a.from("organizations").select("id, name, slug, created_by, active").eq("id",h.organization_id).eq("active",!0).maybeSingle();c?console.error("Erro ao carregar organiza\xe7\xe3o:",c):j=b;let{data:d,error:e}=await a.from("stores").select(`
        id,
        organization_id,
        name,
        slug,
        segment,
        cnpj,
        tax_regime,
        operating_days_per_month,
        timezone,
        active
      `).eq("organization_id",h.organization_id).eq("active",!0).order("created_at",{ascending:!0}).limit(1).maybeSingle();e?console.error("Erro ao carregar loja:",e):k=d}let l=b.email?.split("@")[0]?.trim()||"",m=f?.full_name?.trim()||l||"Usu\xe1rio",n=function(a){let b=a.trim();if(!b)return"NE";let c=b.split(/\s+/).filter(Boolean);return c.length>=2?`${c[0][0]}${c[c.length-1][0]}`.toUpperCase():c[0].slice(0,2).toUpperCase()}(m),o=k?.name||j?.name||"Minha empresa";return{user:{id:b.id,email:b.email??null},profile:f??null,membership:h??null,organization:j,store:k,displayName:m,initials:n,companyName:o}}}};