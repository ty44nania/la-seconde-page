import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tfcjnuumibxnukitshts.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tn_VDS-a0xb-ZBnOEK3Azg__4Ib87eK";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const MAX_IMAGES = 6;
const $ = (id) => document.getElementById(id);
const state = {
  products: [],
  cart: new Set(JSON.parse(localStorage.getItem("lsp-cart") || "[]")),
  user: null,
  editingImages: [],
  selectedFiles: [],
  activeDetailId: null,
  activeDetailPhotoIdx: 0,
  slipDataUrl: ""
};
const money = (n) => `${Number(n || 0).toLocaleString("th-TH")} บาท`;
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusText = (s) => ({available:"พร้อมจำหน่าย",reserved:"จองแล้ว",sold:"ขายแล้ว"}[s] || s);
const toast = (msg) => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2400); };
const openPanel = (id) => { $(id).classList.add("open"); $(id).setAttribute("aria-hidden","false"); };
const closePanel = (id) => { $(id).classList.remove("open"); $(id).setAttribute("aria-hidden","true"); };

function getImages(p){
  const list = Array.isArray(p?.image_urls) && p.image_urls.length
    ? p.image_urls
    : (p?.image_url ? [p.image_url] : []);
  return [...new Set(list.filter(Boolean))].slice(0, MAX_IMAGES);
}

document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closePanel(b.dataset.close)));
$("homeLink").addEventListener("click",e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});});
$("cartOpen").addEventListener("click",()=>{renderCart();openPanel("cartPanel");});
$("adminOpen").addEventListener("click",()=>{openPanel("adminPanel");renderAdminState();});
$("searchInput").addEventListener("input",renderBooks);
$("categoryFilter").addEventListener("change",renderBooks);
$("statusFilter").addEventListener("change",renderBooks);
$("copyOrder").addEventListener("click",copyOrder);
$("saveOrderImage")?.addEventListener("click",openOrderSlipPreview);
$("downloadSlipImage")?.addEventListener("click",downloadOrderSlipImage);
$("clearCart").addEventListener("click",()=>{state.cart.clear();saveCart();renderCart();renderBooks();toast("ล้างรายการแล้ว");});
$("loginButton").addEventListener("click",login);
$("logoutButton").addEventListener("click",logout);
$("productForm").addEventListener("submit",saveProduct);
$("resetForm").addEventListener("click",resetForm);
$("pImage").addEventListener("change",previewFiles);
$("detailAddCart").addEventListener("click",()=>{
  if(!state.activeDetailId)return;
  toggleCart(state.activeDetailId);
  syncDetailButton();
});

function saveCart(){localStorage.setItem("lsp-cart",JSON.stringify([...state.cart]));$("cartCount").textContent=state.cart.size;}
function cover(p){
  const imgs = getImages(p);
  if(imgs.length){
    return `<img src="${esc(imgs[0])}" alt="ปกหนังสือ ${esc(p.title)}" loading="lazy">`;
  }
  return `<div class="cover-placeholder">La<br>Seconde<br>Page ♡</div>`;
}
function categories(){
  const cats=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th"));
  const old=$("categoryFilter").value;
  $("categoryFilter").innerHTML='<option value="">ทุกหมวดหมู่</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("categoryFilter").value=cats.includes(old)?old:"";
  $("categoryOptions").innerHTML=cats.map(c=>`<option value="${esc(c)}">`).join("");
}
function renderBooks(){
  const term=$("searchInput").value.trim().toLowerCase(), cat=$("categoryFilter").value, status=$("statusFilter").value;
  let list=state.products.filter(p=>(!term||[p.title,p.author,p.code,p.category].some(x=>(x||"").toLowerCase().includes(term)))&&(!cat||p.category===cat)&&(status==="all"||p.status==="available"));
  $("bookGrid").innerHTML=list.length?list.map(p=>`
    <article class="book-card">
      <div class="cover-wrap">${cover(p)}<span class="status-tag ${p.status==="sold"?"sold":""}">${statusText(p.status)}</span></div>
      <div class="book-info"><span class="book-code">${esc(p.code)}</span><h3>${esc(p.title)}</h3>
      <p class="book-author">${esc(p.author||p.category||"หนังสือมือสอง")}</p>
      <p class="book-price">${money(p.price)}</p><p class="book-condition">${esc(p.condition||"ยังไม่มีรายละเอียดสภาพ")}</p>
      <div class="card-actions"><button class="detail-button" data-detail="${p.id}">รายละเอียด</button><button class="add-button" data-add="${p.id}" ${p.status!=="available"?"disabled":""}>${state.cart.has(p.id)?"เลือกแล้ว ✓":"เลือกเล่มนี้ +"}</button></div></div>
    </article>`).join(""):'<div class="empty-state">ยังไม่พบหนังสือ ลองเลือกหมวดหมู่อื่นนะคะ ♡</div>';
  $("bookGrid").querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>toggleCart(b.dataset.add)));
  $("bookGrid").querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.detail)));
}
function toggleCart(id){if(state.cart.has(id))state.cart.delete(id);else state.cart.add(id);saveCart();renderBooks();renderCart();toast(state.cart.has(id)?"เพิ่มในรายการที่เลือกแล้ว ♡":"นำออกจากรายการแล้ว");}
function renderCart(){
  const items=state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  $("cartItems").innerHTML=items.length?items.map(p=>{
    const imgs=getImages(p);
    return `<div class="cart-row">${imgs.length?`<img src="${esc(imgs[0])}" alt="">`:'<div class="cart-thumb"></div>'}<div><strong>${esc(p.title)}</strong><small>${esc(p.code)} · ${money(p.price)}</small></div><button class="remove-item" data-remove="${p.id}" aria-label="นำออก">×</button></div>`;
  }).join(""):'<div class="empty-state">ยังไม่มีหนังสือในรายการที่เลือก ♡</div>';
  $("cartItems").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>toggleCart(b.dataset.remove)));
}
function copyOrder(){
  const items=state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  if(!items.length){toast("ยังไม่มีหนังสือที่เลือก");return;}
  const subtotal = items.reduce((sum,p)=>sum+Number(p.price||0),0);
  const text=[
    "La Seconde Page",
    "--------------------",
    ...items.map((p,i)=>`${i+1}. ${p.code} · ${p.title} (${money(p.price)})`),
    "--------------------",
    `ค่าหนังสือรวม: ${money(subtotal)}`,
    "ค่าจัดส่ง: รอการตรวจสอบจากทางร้าน",
    "ส่งไปรษณีย์ธรรมดา / นัดรับใกล้เคียง",
    "TEL. 093-098-5729 | LINE: @mania2550"
  ].join("\n");
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast("คัดลอกรายการแล้ว นำไปส่งได้เลยค่ะ")).catch(()=>toast("ไม่สามารถคัดลอกได้ กรุณาแคปหน้าจอแทน"));}
  else toast("กรุณาแคปหน้าจอรายการแล้วส่งให้ร้านนะคะ");
}

function wrapTextLines(ctx, text, maxWidth){
  const chars = Array.from(String(text || ""));
  const lines = [];
  let line = "";
  for(const ch of chars){
    const test = line + ch;
    if(ctx.measureText(test).width > maxWidth && line){
      lines.push(line);
      line = ch;
    }else{
      line = test;
    }
  }
  if(line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawRoundedRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function buildOrderSlipCanvas(items){
  const subtotal = items.reduce((sum,p)=>sum+Number(p.price||0),0);
  const width = 900;
  const padX = 56;
  const contentW = width - padX * 2;
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = '500 24px "Noto Sans Thai", sans-serif';

  const itemRows = items.map((p, idx)=>{
    const titleStr = `${idx+1}. ${p.code} — ${p.title}`;
    const priceStr = money(p.price);
    const titleLines = wrapTextLines(mctx, titleStr, contentW - 170);
    return { titleLines, priceStr, rowH: Math.max(44, titleLines.length * 32 + 12) };
  });

  const itemsBlockH = itemRows.reduce((a,b)=>a+b.rowH, 0) + 24;
  const height = 390 + itemsBlockH + 220;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fffaf8";
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#efd6e0";
  ctx.stroke();

  let y = 84;
  ctx.fillStyle = "#b17a91";
  ctx.font = '700 16px "DM Sans", sans-serif';
  ctx.fillText("LA SECONDE PAGE · ORDER SLIP", padX, y);

  y += 44;
  ctx.fillStyle = "#82445f";
  ctx.font = '600 38px "Cormorant Garamond", "Noto Sans Thai", serif';
  ctx.fillText("ใบสั่งซื้อหนังสือ", padX, y);

  const dateText = new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  ctx.fillStyle = "#927e87";
  ctx.font = '400 20px "Noto Sans Thai", sans-serif';
  ctx.fillText(`วันที่: ${dateText}  ·  จำนวน ${items.length} เล่ม`, padX, y + 36);

  y += 66;
  ctx.strokeStyle = "#f0dfe5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  y += 34;
  for(const row of itemRows){
    ctx.fillStyle = "#51434a";
    ctx.font = '500 24px "Noto Sans Thai", sans-serif';
    row.titleLines.forEach((ln, li)=>{
      ctx.fillText(ln, padX, y + li * 32);
    });
    ctx.fillStyle = "#82445f";
    ctx.font = '600 24px "Noto Sans Thai", sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(row.priceStr, width - padX, y);
    ctx.textAlign = "left";
    y += row.rowH;
  }

  y += 12;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  y += 44;
  ctx.fillStyle = "#51434a";
  ctx.font = '500 24px "Noto Sans Thai", sans-serif';
  ctx.fillText("ค่าหนังสือรวม", padX, y);
  ctx.fillStyle = "#82445f";
  ctx.font = '700 26px "Noto Sans Thai", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(money(subtotal), width - padX, y);
  ctx.textAlign = "left";

  y += 44;
  ctx.fillStyle = "#51434a";
  ctx.font = '500 24px "Noto Sans Thai", sans-serif';
  ctx.fillText("ค่าจัดส่ง", padX, y);
  ctx.fillStyle = "#927e87";
  ctx.font = '400 22px "Noto Sans Thai", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("รอการตรวจสอบจากทางร้าน", width - padX, y);
  ctx.textAlign = "left";

  y += 26;
  drawRoundedRect(ctx, padX, y, contentW, 118, 18);
  ctx.fillStyle = "#fff5f8";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#efd7e1";
  ctx.stroke();

  ctx.fillStyle = "#51434a";
  ctx.font = '400 21px "Noto Sans Thai", sans-serif';
  ctx.fillText("จัดส่งแบบพัสดุไปรษณีย์ธรรมดา หรือนัดรับในบริเวณใกล้เคียงได้ค่ะ", padX + 22, y + 44);
  ctx.fillStyle = "#82445f";
  ctx.font = '600 21px "Noto Sans Thai", sans-serif';
  ctx.fillText("TEL. 093-098-5729  ·  LINE: @mania2550", padX + 22, y + 84);

  y += 156;
  ctx.fillStyle = "#927e87";
  ctx.font = '400 18px "Noto Sans Thai", sans-serif';
  ctx.fillText("รวมเฉพาะค่าหนังสือและเว้นค่าส่งไว้ · ร้านจะแจ้งยอดสุทธิหลังตรวจสอบสินค้าค่ะ ♡", padX, y);

  return canvas;
}

function openOrderSlipPreview(){
  const items = state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  if(!items.length){
    toast("ยังไม่มีหนังสือในรายการที่เลือก");
    return;
  }
  const canvas = buildOrderSlipCanvas(items);
  state.slipDataUrl = canvas.toDataURL("image/png");
  $("slipPreviewBox").innerHTML = `<img src="${state.slipDataUrl}" alt="ใบสั่งซื้อหนังสือ La Seconde Page">`;
  openPanel("orderSlipModal");
}

async function downloadOrderSlipImage(){
  if(!state.slipDataUrl) return;
  try{
    const res = await fetch(state.slipDataUrl);
    const blob = await res.blob();
    const fileName = `la-seconde-page-order-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: "image/png" });
    if(navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], title: "ใบสั่งซื้อหนังสือ — La Seconde Page" });
      toast("เปิดเมนูบันทึกรูปใบสั่งซื้อแล้วค่ะ ♡");
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    toast("บันทึกรูปใบสั่งซื้อแล้วค่ะ ♡");
  }catch(_err){
    toast("แตะค้างที่รูปใบสั่งซื้อด้านบนเพื่อบันทึกรูปได้เลยค่ะ");
  }
}

function syncDetailButton(){
  const p=state.products.find(x=>x.id===state.activeDetailId);
  if(!p)return;
  const btn=$("detailAddCart");
  btn.disabled=p.status!=="available";
  btn.textContent=p.status!=="available"
    ? statusText(p.status)
    : (state.cart.has(p.id)?"เลือกแล้ว ✓":"เลือกเล่มนี้ +");
}
function renderDetailGallery(imgs, title){
  if(!imgs.length){
    $("detailGallery").innerHTML=`<div class="detail-main-photo"><div class="cover-placeholder">La<br>Seconde<br>Page ♡</div></div>`;
    return;
  }
  const idx=Math.min(Math.max(state.activeDetailPhotoIdx,0),imgs.length-1);
  state.activeDetailPhotoIdx=idx;
  const thumbs=imgs.length>1
    ? `<div class="detail-thumbs">${imgs.map((u,i)=>`<button type="button" class="detail-thumb ${i===idx?"active":""}" data-photo-idx="${i}" aria-label="ดูรูปที่ ${i+1}"><img src="${esc(u)}" alt="${esc(title)} รูปที่ ${i+1}"></button>`).join("")}</div>`
    : "";
  $("detailGallery").innerHTML=`<div class="detail-main-photo"><img src="${esc(imgs[idx])}" alt="${esc(title)} รูปที่ ${idx+1}"></div>${thumbs}`;
  $("detailGallery").querySelectorAll("[data-photo-idx]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      state.activeDetailPhotoIdx=Number(btn.dataset.photoIdx);
      renderDetailGallery(imgs, title);
    });
  });
}
function showDetail(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  state.activeDetailId=p.id;
  state.activeDetailPhotoIdx=0;
  const imgs=getImages(p);
  $("detailCode").textContent=`BOOK CODE · ${p.code || "-"}`;
  $("detailTitle").textContent=p.title;
  renderDetailGallery(imgs, p.title);
  $("detailMeta").innerHTML=`
    <p class="detail-price">${money(p.price)}</p>
    <p class="detail-row"><strong>สถานะ:</strong> ${esc(statusText(p.status))}</p>
    <p class="detail-row"><strong>ผู้เขียน:</strong> ${esc(p.author||"-")}</p>
    <p class="detail-row"><strong>หมวดหมู่:</strong> ${esc(p.category||"-")}</p>
    <div class="detail-box"><strong>สภาพและตำหนิ</strong><p>${esc(p.condition||"ยังไม่มีรายละเอียดสภาพ")}</p></div>
    <div class="detail-box"><strong>รายละเอียดเพิ่มเติม</strong><p>${esc(p.description||"-")}</p></div>
  `;
  syncDetailButton();
  openPanel("detailPanel");
}
async function loadProducts(){
  if(!configured){state.products=[];$("bookGrid").innerHTML='<div class="empty-state">เว็บไซต์พร้อมแล้ว ♡<br>ขั้นตอนถัดไปคือเชื่อมฐานข้อมูล Supabase ตามคู่มือ SETUP-TH.md<br>เมื่อเชื่อมต่อแล้ว หนังสือที่คุณเพิ่มจะปรากฏตรงนี้</div>';return;}
  const {data,error}=await supabase.from("products").select("*").order("created_at",{ascending:false});
  if(error){$("bookGrid").innerHTML=`<div class="empty-state">โหลดหนังสือไม่สำเร็จ: ${esc(error.message)}</div>`;return;}
  state.products=data||[];categories();renderBooks();renderCart();renderAdminProducts();
}
async function login(){
  if(!configured){$("adminMessage").textContent="กรุณาตั้งค่า Supabase ใน app.js ก่อน";return;}
  $("adminMessage").textContent="กำลังเข้าสู่ระบบ…";
  const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
  if(error){$("adminMessage").textContent="เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน";return;}
  state.user=data.user;renderAdminState();toast("เข้าสู่ระบบแล้ว");
}
async function logout(){if(supabase)await supabase.auth.signOut();state.user=null;renderAdminState();toast("ออกจากระบบแล้ว");}
function renderAdminState(){
  const logged=!!state.user;$("loginView").hidden=logged;$("adminView").hidden=!logged;
  if(logged){$("adminWelcome").textContent=`เข้าสู่ระบบ: ${state.user.email}`;renderAdminProducts();}
}
function resetForm(){
  $("productForm").reset();$("productId").value="";$("formTitle").textContent="เพิ่มหนังสือเล่มใหม่";
  state.editingImages=[];state.selectedFiles=[];
  $("imagePreview").innerHTML="ยังไม่ได้เลือกรูป";
}
function previewFiles(){
  const files=Array.from($("pImage").files||[]);
  if(files.length>MAX_IMAGES){
    toast(`เลือกได้สูงสุด ${MAX_IMAGES} รูปต่อเล่ม ระบบจะใช้ ${MAX_IMAGES} รูปแรก`);
  }
  state.selectedFiles=files.slice(0,MAX_IMAGES);
  renderFormPreviews();
}
function renderFormPreviews(){
  const previewUrls = state.selectedFiles.length
    ? state.selectedFiles.map(f=>URL.createObjectURL(f))
    : state.editingImages;
  if(!previewUrls.length){
    $("imagePreview").innerHTML="ยังไม่ได้เลือกรูป";
    return;
  }
  $("imagePreview").innerHTML=previewUrls.map((url,i)=>`
    <div class="image-preview-item">
      <img src="${esc(url)}" alt="รูปที่ ${i+1}">
      <span class="image-badge">${i===0?"ปก":`รูป ${i+1}`}</span>
    </div>
  `).join("");
}
function renderAdminProducts(){
  if(!state.user)return;
  $("adminProductCount").textContent=`${state.products.length} เล่ม`;
  $("adminProducts").innerHTML=state.products.length?state.products.map(p=>{
    const imgs=getImages(p);
    return `<div class="admin-product">${imgs.length?`<img src="${esc(imgs[0])}" alt="">`:'<div class="cover-placeholder">♡</div>'}<div class="admin-product-main"><strong>${esc(p.code)} · ${esc(p.title)}</strong><small>${money(p.price)} · ${statusText(p.status)}</small></div><button data-edit="${p.id}">แก้ไข</button><button data-delete="${p.id}">ลบ</button></div>`;
  }).join(""):'<p class="tiny-note">ยังไม่มีหนังสือ เพิ่มเล่มแรกของคุณได้เลย</p>';
  $("adminProducts").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
  $("adminProducts").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
}
function editProduct(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  $("productId").value=p.id;$("pCode").value=p.code;$("pTitle").value=p.title;$("pAuthor").value=p.author||"";
  $("pPrice").value=p.price??"";$("pCategory").value=p.category||"";$("pStatus").value=p.status;
  $("pCondition").value=p.condition||"";$("pDescription").value=p.description||"";
  state.editingImages=getImages(p);state.selectedFiles=[];$("pImage").value="";
  renderFormPreviews();
  $("formTitle").textContent="แก้ไขข้อมูลหนังสือ";$("productForm").scrollIntoView({behavior:"smooth"});
}
async function uploadImageFiles(files){
  const urls=[];
  for(const file of files.slice(0,MAX_IMAGES)){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${crypto.randomUUID()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("book-images").upload(path,file,{upsert:false});
    if(upErr)throw new Error("อัปโหลดรูปไม่สำเร็จ: "+upErr.message);
    urls.push(supabase.storage.from("book-images").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
async function saveProduct(e){
  e.preventDefault();if(!state.user)return;
  const id=$("productId").value;
  let finalImages=[...state.editingImages];
  try{
    if(state.selectedFiles.length){
      finalImages=await uploadImageFiles(state.selectedFiles);
    }
  }catch(err){
    $("adminMessage").textContent=err.message;
    return;
  }
  const record={
    code:$("pCode").value.trim(),
    title:$("pTitle").value.trim(),
    author:$("pAuthor").value.trim(),
    price:Number($("pPrice").value||0),
    category:$("pCategory").value.trim(),
    status:$("pStatus").value,
    condition:$("pCondition").value.trim(),
    description:$("pDescription").value.trim(),
    image_url:finalImages[0]||null,
    image_urls:finalImages
  };
  let result=id
    ? await supabase.from("products").update(record).eq("id",id)
    : await supabase.from("products").insert(record);

  if(result.error && /image_urls|column/i.test(result.error.message||"")){
    const {image_urls,...fallbackRecord}=record;
    result=id
      ? await supabase.from("products").update(fallbackRecord).eq("id",id)
      : await supabase.from("products").insert(fallbackRecord);
    if(!result.error){
      toast("บันทึกปกสำเร็จ (แนะนำเพิ่มคอลัมน์ image_urls ใน Supabase เพื่อเก็บหลายรูป)");
    }
  }
  if(result.error){$("adminMessage").textContent="บันทึกไม่สำเร็จ: "+result.error.message;return;}
  $("adminMessage").textContent="บันทึกหนังสือเรียบร้อยแล้ว ♡";resetForm();await loadProducts();toast("บันทึกหนังสือแล้ว");
}
async function deleteProduct(id){
  if(!confirm("ต้องการลบหนังสือเล่มนี้ใช่ไหม?"))return;
  const {error}=await supabase.from("products").delete().eq("id",id);
  if(error){$("adminMessage").textContent="ลบไม่สำเร็จ: "+error.message;return;}
  state.cart.delete(id);saveCart();await loadProducts();toast("ลบหนังสือแล้ว");
}
async function init(){
  saveCart();
  if(configured){
    const {data}=await supabase.auth.getSession();state.user=data.session?.user||null;renderAdminState();
    supabase.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;renderAdminState();});
    await loadProducts();
  }else{
    $("bookGrid").innerHTML='<div class="empty-state">ชั้นหนังสือกำลังเตรียมเปิดให้บริการ ♡<br>เชื่อม Supabase ตามคู่มือเพื่อเริ่มเพิ่มสินค้า</div>';
    $("loginView").hidden=false;
  }
}
init();
