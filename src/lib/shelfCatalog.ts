import { libraryItems,type LibraryItem } from './libraryCatalog';
import { supabaseRpc,type SiteStorageEnv } from './siteStorage';
import { slugPattern } from './knowledgeShelf';

export async function resolveShelfCatalog(env:SiteStorageEnv):Promise<LibraryItem[]>{
  try{
    const rows=await supabaseRpc<unknown>(env,'knowledge_shelf_catalog_v1');
    if(!Array.isArray(rows))return libraryItems;
    const live=rows.filter(r=>r&&typeof r.slug==='string'&&slugPattern.test(r.slug)
      &&typeof r.title==='string'&&typeof r.summary==='string'
      &&Number.isSafeInteger(r.price_jpy)&&r.price_jpy>=50
      &&typeof r.checkout_url==='string'&&/^https:\/\/buy\.stripe\.com\/[a-zA-Z0-9_-]+$/.test(r.checkout_url));
    const liveItems:LibraryItem[]=live.map((r,index)=>({
      ...(libraryItems.find(item=>item.slug===r.slug)||{category:'OS',format:'GUIDE / WORKSHEET',coverNo:String(index+1).padStart(2,'0'),
        takeaways:['核となる考え方を読む','自分の状況へ当てはめる','小さな実践と振り返りへ進む'],bridge:'使った後の問いを、次の学びへつなげる。',lineKeyword:'教材'}),
      slug:r.slug,title:r.title,subtitle:r.summary,description:r.summary,priceYen:r.price_jpy,
      status:'live',access:'one-time',releaseLabel:'公開中',checkoutUrl:r.checkout_url,
    }));
    return [...liveItems,...libraryItems.filter(item=>!liveItems.some(live=>live.slug===item.slug))];
  }catch{return libraryItems;}
}
