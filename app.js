import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tfcjnuumibxnukitshts.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tn_VDS-a0xb-ZBnOEK3Azg__4Ib87eK";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const MAX_IMAGES = 6;
const CART_TTL_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;

const PROVINCES_77 = [
  "กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท",
  "ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม",
  "นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์",
  "ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์",
  "แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง",
  "ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ",
  "สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย",
  "หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"
];

const DEFAULT_SETTINGS = {
  ig_handle: "la_seconde_page_",
  ig_url: "https://www.instagram.com/la_seconde_page_?dmpr=MWhocGdmNmgzcHRnZA%3D%3D&utm_source=qr",
  promo_active: false,
  promo_min_qty: 2,
  promo_type: "percent",
  promo_value: 0,
  bubble_weight: 20,
  box_weight_a: 55,
  box_weight_b: 90,
  box_weight_c: 130,
  box_weight_reuse: 90,
  bkk_base_rate: 35,
  upc_base_rate: 45
};

const $ = (id) => document.getElementById(id);
const state = {
  products: [],
  settings: { ...DEFAULT_SETTINGS },
  cart: new Set(JSON.parse(localStorage.getItem("lsp-cart") || "[]")),
  expiresAt: Number(localStorage.getItem("lsp-cart-exp") || 0),
  province: localStorage.getItem("lsp-province") || "",
  bkkMethod: localStorage.getItem("lsp-bkk-method") || "post",
  user: null,
  editingImages: [],
  selectedFiles: [],
  activeDetailId: null,
  activeDetailPhotoIdx: 0,
  slipDataUrl: "",
  warnedTwoMin: false
};

const money = (n) => `${Number(n || 0).toLocaleString("th-TH")} บาท`;
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusText = (s) => ({available:"พร้อมจำหน่าย",reserved:"จองแล้ว",sold:"ขายแล้ว"}[s] || s);
const toast = (msg) => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2600); };
const openPanel = (id) => { $(id).classList.add("open"); $(id).setAttribute("aria-hidden","false"); };
const closePanel = (id) => { $(id).classList.remove("open"); $(id).setAttribute("aria-hidden","true"); };

function getImages(p){
  const list = Array.isArray(p?.image_urls) && p.image_urls.length
    ? p.image_urls
    : (p?.image_url ? [p.image_url] : []);
  return [...new Set(list.filter(Boolean))].slice(0, MAX_IMAGES);
}

function initProvinceDatalist(){
  const dl = $("provinceList");
  if(!dl) return;
  dl.innerHTML = PROVINCES_77.map(prov => `<option value="${esc(prov)}"></option>`).join("");
  if($("provinceInput")) $("provinceInput").value = state.province;
  document.querySelectorAll('input[name="bkkMethod"]').forEach(r => {
    r.checked = r.value === state.bkkMethod;
  });
}

function syncProvinceUI(){
  const raw = ($("provinceInput")?.value || "").trim();
  const matched = PROVINCES_77.find(p => p === raw) || "";
  state.province = matched || raw;
  localStorage.setItem("lsp-province", state.province);

  const isBkk = matched === "กรุงเทพมหานคร";
  $("bkkMethodBox").hidden = !isBkk;
  if(isBkk){
    const checked = document.querySelector('input[name="bkkMethod"]:checked')?.value || "post";
    state.bkkMethod = checked;
    localStorage.setItem("lsp-bkk-method", state.bkkMethod);
    $("meetupNote").hidden = state.bkkMethod !== "meetup";
  }else{
    $("meetupNote").hidden = true;
  }
  renderOrderSummary();
}

function saveCart(){
  localStorage.setItem("lsp-cart", JSON.stringify([...state.cart]));
  $("cartCount").textContent = state.cart.size;
  if(state.cart.size > 0){
    if(!state.expiresAt || state.expiresAt <= Date.now()){
      state.expiresAt = Date.now() + CART_TTL_MS;
      localStorage.setItem("lsp-cart-exp", String(state.expiresAt));
    }
  }else{
    state.expiresAt = 0;
    localStorage.removeItem("lsp-cart-exp");
    state.warnedTwoMin = false;
  }
  updateTimerUI();
}

function extendCartTimer(){
  if(!state.cart.size) return;
  state.expiresAt = Date.now() + CART_TTL_MS;
  localStorage.setItem("lsp-cart-exp", String(state.expiresAt));
  state.warnedTwoMin = false;
  updateTimerUI();
  toast("ต่อเวลาถือรายการเพิ่ม 30 นาทีแล้วค่ะ ♡");
}

function expireCartIfNeeded(){
  if(state.cart.size > 0 && state.expiresAt > 0 && Date.now() >= state.expiresAt){
    state.cart.clear();
    state.expiresAt = 0;
    state.warnedTwoMin = false;
    localStorage.removeItem("lsp-cart");
    localStorage.removeItem("lsp-cart-exp");
    renderBooks();
    renderCart();
    updateTimerUI();
    toast("หมดเวลาถือรายการไว้ชั่วคราวแล้วค่ะ เลือกใหม่ได้เสมอนะคะ");
  }
}

function updateTimerUI(){
  const banner = $("cartTimerBanner");
  if(!banner) return;
  if(!state.cart.size || !state.expiresAt){
    banner.hidden = true;
    banner.classList.remove("urgent");
    return;
  }
  const remMs = Math.max(0, state.expiresAt - Date.now());
  const totalSec = Math.floor(remMs / 1000);
  const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");
  banner.hidden = false;
  $("cartTimerText").textContent = `เหลือเวลาถือรายการ ${mins}:${secs}`;

  const isUrgent = remMs <= WARN_BEFORE_MS && remMs > 0;
  banner.classList.toggle("urgent", isUrgent);
  if(isUrgent){
    $("cartTimerSub").textContent = "ใกล้ครบกำหนดแล้ว กดต่อเวลาหรือส่งรายการได้เลยค่ะ";
    if(!state.warnedTwoMin){
      state.warnedTwoMin = true;
      toast("เหลือเวลาถือรายการอีก 2 นาที กดต่อเวลาได้ในถุงหนังสือน้า ♡");
    }
  }else{
    $("cartTimerSub").textContent = "ระบบจะปล่อยรายการออกอัตโนมัติเมื่อครบ 30 นาที";
  }
}

function calcBookWeightGrams(book){
  const pages = Number(book?.page_count) > 0 ? Number(book.page_count) : 200;
  const effectivePages = pages <= 150 ? 150 : 150 + Math.ceil((pages - 150) / 50) * 50;
  const stepsOver150 = Math.max(0, (effectivePages - 150) / 50);
  const bookPlusBubble = 230 + stepsOver150 * 70;
  const bubbleOverride = Number(state.settings.bubble_weight) || 20;
  return Math.max(50, bookPlusBubble + (bubbleOverride - 20));
}

function calcBoxWeightGrams(items){
  const s = state.settings;
  const boxMap = {
    A: Number(s.box_weight_a ?? 55),
    B: Number(s.box_weight_b ?? 90),
    C: Number(s.box_weight_c ?? 130),
    reuse: Number(s.box_weight_reuse ?? s.box_weight_b ?? 90)
  };
  const chosen = items[0]?.box_size || "B";
  return boxMap[chosen] ?? boxMap.B;
}

function calcShippingAndDiscount(items){
  const s = state.settings;
  const subtotal = items.reduce((sum, p) => sum + Number(p.price || 0), 0);

  let discount = 0;
  if(s.promo_active && items.length >= Number(s.promo_min_qty || 1)){
    const val = Number(s.promo_value || 0);
    if(val > 0){
      discount = s.promo_type === "amount"
        ? Math.round(val)
        : Math.round((subtotal * val) / 100);
      discount = Math.min(subtotal, Math.max(0, discount));
    }
  }

  const raw = (state.province || "").trim();
  const matchedProvince = PROVINCES_77.find(p => p === raw) || "";
  let shippingCost = null;
  let shippingLabel = "รอเลือกจังหวัด";
  let shippingNote = "";
  let totalWeightGrams = 0;

  if(items.length && matchedProvince){
    const booksWeight = items.reduce((sum, p) => sum + calcBookWeightGrams(p), 0);
    const boxWeight = calcBoxWeightGrams(items);
    totalWeightGrams = booksWeight + boxWeight;

    if(matchedProvince === "กรุงเทพมหานคร"){
      if(state.bkkMethod === "meetup"){
        shippingCost = 0;
        shippingLabel = "นัดรับ MRT ห้วยขวาง (0 บาท)";
        shippingNote = "ไม่สามารถระบุวันรับล่วงหน้าได้ รอวันเวลาที่ว่างตรงกันค่ะ";
      }else{
        const base = Number(s.bkk_base_rate ?? 35);
        const extraTier = totalWeightGrams <= 500 ? 0 : Math.floor((totalWeightGrams - 1) / 500) * 10;
        shippingCost = base + extraTier;
        shippingLabel = `ส่งไปรษณีย์ (กทม. · ~${totalWeightGrams}g)`;
      }
    }else{
      const base = Number(s.upc_base_rate ?? 45);
      const extraTier = totalWeightGrams <= 500 ? 0 : Math.floor((totalWeightGrams - 1) / 500) * 10;
      shippingCost = base + extraTier;
      shippingLabel = `ส่งไปรษณีย์ (${matchedProvince} · ~${totalWeightGrams}g)`;
    }
  }

  const netBooks = Math.max(0, subtotal - discount);
  const grandTotal = shippingCost === null ? null : netBooks + shippingCost;

  return {
    subtotal,
    discount,
    netBooks,
    shippingCost,
    shippingLabel,
    shippingNote,
    totalWeightGrams,
    grandTotal,
    matchedProvince
  };
}

function renderOrderSummary(){
  const items = state.products.filter(p => state.cart.has(p.id) && p.status === "available");
  const calc = calcShippingAndDiscount(items);
  const box = $("orderSummaryBox");
  if(!box) return;

  if(!items.length){
    box.innerHTML = "";
    $("shippingSummaryLine").textContent = "เลือกหนังสือเพื่อดูสรุปยอดและค่าจัดส่งค่ะ";
    return;
  }

  const minQty = Number(state.settings.promo_min_qty || 1);
  const promoHint = (state.settings.promo_active && Number(state.settings.promo_value || 0) > 0 && items.length < minQty)
    ? `<p class="tiny-note">โปรโมชัน: เลือกเพิ่มอีก ${minQty - items.length} เล่ม (ครบ ${minQty} เล่ม) เพื่อรับส่วนลดค่ะ</p>`
    : "";
  const discountRow = calc.discount > 0
    ? `<div class="summary-row discount"><span>ส่วนลดโปรโมชัน</span><span>-${money(calc.discount)}</span></div>`
    : promoHint;
  const shipText = calc.shippingCost === null ? "รอเลือกจังหวัด" : money(calc.shippingCost);
  const totalText = calc.grandTotal === null ? `ตั้งแต่ ${money(calc.netBooks)} (+ ค่าส่ง)` : money(calc.grandTotal);

  box.innerHTML = `
    <div class="summary-row"><span>ค่าหนังสือรวม (${items.length} เล่ม)</span><span>${money(calc.subtotal)}</span></div>
    ${discountRow}
    <div class="summary-row"><span>${esc(calc.shippingLabel)}</span><span>${esc(shipText)}</span></div>
    ${calc.shippingNote ? `<p class="tiny-note">${esc(calc.shippingNote)}</p>` : ""}
    <div class="summary-row total"><span>ยอดรวมสุทธิ</span><span>${esc(totalText)}</span></div>
  `;
  $("shippingSummaryLine").textContent = calc.shippingCost === null
    ? "เลือกจังหวัดด้านบนเพื่อคำนวณค่าจัดส่งค่ะ"
    : `${calc.shippingLabel} · ${shipText}`;
}

document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closePanel(b.dataset.close)));
$("homeLink").addEventListener("click",e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});});
$("cartOpen").addEventListener("click",()=>{expireCartIfNeeded();renderCart();openPanel("cartPanel");});
$("adminOpen").addEventListener("click",()=>{openPanel("adminPanel");renderAdminState();});
$("extendTimerBtn")?.addEventListener("click",extendCartTimer);
$("provinceInput")?.addEventListener("input",syncProvinceUI);
$("provinceInput")?.addEventListener("change",syncProvinceUI);
document.querySelectorAll('input[name="bkkMethod"]').forEach(r => r.addEventListener("change",syncProvinceUI));
$("searchInput").addEventListener("input",renderBooks);
$("categoryFilter").addEventListener("change",renderBooks);
$("statusFilter").addEventListener("change",renderBooks);
$("copyOrder").addEventListener("click",copyOrder);
$("saveOrderImage")?.addEventListener("click",openOrderSlipPreview);
$("downloadSlipImage")?.addEventListener("click",downloadOrderSlipImage);
$("clearCart").addEventListener("click",()=>{state.cart.clear();saveCart();renderCart();renderBooks();toast("ล้างรายการแล้ว");});
$("loginButton").addEventListener("click",login);
$("logoutButton").addEventListener("click",logout);
$("settingsForm")?.addEventListener("submit",saveSettings);
$("productForm").addEventListener("submit",saveProduct);
$("resetForm").addEventListener("click",resetForm);
$("pImage").addEventListener("change",previewFiles);
$("detailAddCart").addEventListener("click",()=>{
  if(!state.activeDetailId)return;
  toggleCart(state.activeDetailId);
  syncDetailButton();
});

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
      <div class="card-actions"><button class="detail-button" data-detail="${p.id}">รายละเอียด</button><button class="add-button" data-add="${p.id}" ${p.status!=="available"?"disabled":""}>${state.cart.has(p.id)?"กำลังถูกเลือก ✓":"เลือกเล่มนี้ +"}</button></div></div>
    </article>`).join(""):'<div class="empty-state">ยังไม่พบหนังสือ ลองเลือกหมวดหมู่อื่นนะคะ ♡</div>';
  $("bookGrid").querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>toggleCart(b.dataset.add)));
  $("bookGrid").querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.detail)));
}
function toggleCart(id){
  expireCartIfNeeded();
  if(state.cart.has(id))state.cart.delete(id);
  else state.cart.add(id);
  saveCart();
  renderBooks();
  renderCart();
  toast(state.cart.has(id)?"เพิ่มในรายการที่เลือกแล้ว · จับเวลา 30 นาที ♡":"นำออกจากรายการแล้ว");
}
function renderCart(){
  expireCartIfNeeded();
  const items=state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  $("cartItems").innerHTML=items.length?items.map(p=>{
    const imgs=getImages(p);
    return `<div class="cart-row">${imgs.length?`<img src="${esc(imgs[0])}" alt="">`:'<div class="cart-thumb"></div>'}<div><strong>${esc(p.title)}</strong><small>${esc(p.code)} · ${money(p.price)}</small></div><button class="remove-item" data-remove="${p.id}" aria-label="นำออก">×</button></div>`;
  }).join(""):'<div class="empty-state">ยังไม่มีหนังสือในรายการที่เลือก ♡</div>';
  $("cartItems").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>toggleCart(b.dataset.remove)));
  updateTimerUI();
  renderOrderSummary();
}
function copyOrder(){
  expireCartIfNeeded();
  const items=state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  if(!items.length){toast("ยังไม่มีหนังสือที่เลือก");return;}
  const calc = calcShippingAndDiscount(items);
  const ig = state.settings.ig_handle || "la_seconde_page_";
  const lines = [
    "La Seconde Page",
    "--------------------",
    ...items.map((p,i)=>`${i+1}. ${p.code} · ${p.title} (${money(p.price)})`),
    "--------------------",
    `ค่าหนังสือรวม: ${money(calc.subtotal)}`,
    ...(calc.discount > 0 ? [`ส่วนลดโปรโมชัน: -${money(calc.discount)}`] : []),
    `การจัดส่ง: ${calc.shippingLabel} — ${calc.shippingCost === null ? "รอเลือกจังหวัด" : money(calc.shippingCost)}`,
    ...(calc.shippingNote ? [`หมายเหตุ: ${calc.shippingNote}`] : []),
    `ยอดรวมสุทธิ: ${calc.grandTotal === null ? `ตั้งแต่ ${money(calc.netBooks)} (+ ค่าส่ง)` : money(calc.grandTotal)}`,
    `IG: @${ig}`
  ];
  const text = lines.join("\n");
  const openIgLink = () => {
    const url = state.settings.ig_url || `https://www.instagram.com/${ig}/`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text)
      .then(()=>{toast(`คัดลอกแล้ว เปิด IG @${ig} แล้วกดวางส่งได้เลยค่ะ`);openIgLink();})
      .catch(()=>{toast("ไม่สามารถคัดลอกได้ กรุณาแคปหน้าจอแทน");openIgLink();});
  }else{
    toast("กรุณาแคปหน้าจอรายการแล้วส่งให้ร้านนะคะ");
    openIgLink();
  }
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
  const calc = calcShippingAndDiscount(items);
  const ig = state.settings.ig_handle || "la_seconde_page_";
  const width = 900;
  const padX = 56;
  const contentW = width - padX * 2;
  const textMaxW = contentW - 12;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  mctx.font = '500 22px "Noto Sans Thai", sans-serif';

  const itemRows = items.map((p, idx)=>{
    const titleStr = `${idx+1}. ${p.code} — ${p.title}`;
    const priceStr = `ราคา ${money(p.price)}`;
    const titleLines = wrapTextLines(mctx, titleStr, textMaxW);
    return { titleLines, priceStr, rowH: titleLines.length * 32 + 34 + 14 };
  });

  const itemsBlockH = itemRows.reduce((a,b)=>a+b.rowH, 0) + 16;
  const extraDiscountH = calc.discount > 0 ? 58 : 0;
  const extraNoteH = calc.shippingNote ? 36 : 0;
  const height = 430 + itemsBlockH + extraDiscountH + extraNoteH + 220;

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
    ctx.font = '500 22px "Noto Sans Thai", sans-serif';
    row.titleLines.forEach((ln, li)=>{
      ctx.fillText(ln, padX, y + li * 32);
    });
    const priceY = y + row.titleLines.length * 32 + 2;
    ctx.fillStyle = "#82445f";
    ctx.font = '600 21px "Noto Sans Thai", sans-serif';
    ctx.fillText(row.priceStr, padX, priceY);
    y += row.rowH;
  }

  y += 8;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  y += 40;
  ctx.fillStyle = "#51434a";
  ctx.font = '500 22px "Noto Sans Thai", sans-serif';
  ctx.fillText("ค่าหนังสือรวม", padX, y);
  y += 32;
  ctx.fillStyle = "#82445f";
  ctx.font = '700 23px "Noto Sans Thai", sans-serif';
  ctx.fillText(money(calc.subtotal), padX, y);

  if(calc.discount > 0){
    y += 40;
    ctx.fillStyle = "#a75f7b";
    ctx.font = '500 21px "Noto Sans Thai", sans-serif';
    ctx.fillText(`ส่วนลดโปรโมชัน: -${money(calc.discount)}`, padX, y);
  }

  y += 42;
  ctx.fillStyle = "#51434a";
  ctx.font = '500 22px "Noto Sans Thai", sans-serif';
  ctx.fillText(`การจัดส่ง: ${calc.shippingLabel}`, padX, y);
  y += 32;
  ctx.fillStyle = "#82445f";
  ctx.font = '600 21px "Noto Sans Thai", sans-serif';
  ctx.fillText(calc.shippingCost === null ? "รอเลือกจังหวัด" : money(calc.shippingCost), padX, y);

  if(calc.shippingNote){
    y += 32;
    ctx.fillStyle = "#927e87";
    ctx.font = '400 18px "Noto Sans Thai", sans-serif';
    ctx.fillText(calc.shippingNote, padX, y);
  }

  y += 42;
  ctx.fillStyle = "#82445f";
  ctx.font = '700 25px "Noto Sans Thai", sans-serif';
  ctx.fillText(
    `ยอดรวมสุทธิ: ${calc.grandTotal === null ? `ตั้งแต่ ${money(calc.netBooks)} (+ ค่าส่ง)` : money(calc.grandTotal)}`,
    padX,
    y
  );

  y += 30;
  drawRoundedRect(ctx, padX, y, contentW, 92, 18);
  ctx.fillStyle = "#fff5f8";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#efd7e1";
  ctx.stroke();

  ctx.fillStyle = "#82445f";
  ctx.font = '600 21px "Noto Sans Thai", sans-serif';
  ctx.fillText(`ส่งใบสั่งซื้อได้ที่ Instagram: @${ig}`, padX + 22, y + 54);

  y += 130;
  ctx.fillStyle = "#927e87";
  ctx.font = '400 18px "Noto Sans Thai", sans-serif';
  ctx.fillText("กรุณาส่งใบสั่งซื้อให้ทางร้านเพื่อยืนยันสิทธิ์และรอการตรวจสอบอีกครั้งค่ะ ♡", padX, y);

  return canvas;
}

function openOrderSlipPreview(){
  expireCartIfNeeded();
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
    : (state.cart.has(p.id)?"กำลังถูกเลือก ✓":"เลือกเล่มนี้ +");
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

function populateSettingsForm(){
  const s = state.settings;
  if(!$("sPromoActive")) return;
  $("sPromoActive").checked = !!s.promo_active;
  $("sPromoMinQty").value = s.promo_min_qty ?? 2;
  $("sPromoType").value = s.promo_type || "percent";
  $("sPromoValue").value = s.promo_value ?? 0;
  $("sBubbleWeight").value = s.bubble_weight ?? 20;
  $("sBoxWeightB").value = s.box_weight_b ?? 90;
  $("sBkkBaseRate").value = s.bkk_base_rate ?? 35;
  $("sUpcBaseRate").value = s.upc_base_rate ?? 45;
}

async function loadSettings(){
  try{
    const savedLocal = JSON.parse(localStorage.getItem("lsp-settings") || "null");
    if(savedLocal && typeof savedLocal === "object"){
      state.settings = { ...DEFAULT_SETTINGS, ...savedLocal };
      populateSettingsForm();
      renderOrderSummary();
    }
  }catch(_e){}

  if(!configured) return;
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", "default").maybeSingle();
  if(!error && data){
    state.settings = { ...DEFAULT_SETTINGS, ...data };
    localStorage.setItem("lsp-settings", JSON.stringify(state.settings));
    populateSettingsForm();
    renderOrderSummary();
  }
}

async function saveSettings(e){
  e.preventDefault();
  if(!state.user) return;
  const payload = {
    id: "default",
    promo_active: Boolean($("sPromoActive")?.checked),
    promo_min_qty: Math.max(1, Number($("sPromoMinQty")?.value || 1)),
    promo_type: $("sPromoType")?.value === "amount" ? "amount" : "percent",
    promo_value: Math.max(0, Number($("sPromoValue")?.value || 0)),
    bubble_weight: Math.max(0, Number($("sBubbleWeight")?.value || 20)),
    box_weight_b: Math.max(0, Number($("sBoxWeightB")?.value || 90)),
    bkk_base_rate: Math.max(0, Number($("sBkkBaseRate")?.value || 35)),
    upc_base_rate: Math.max(0, Number($("sUpcBaseRate")?.value || 45)),
    updated_at: new Date().toISOString()
  };
  state.settings = { ...state.settings, ...payload };
  localStorage.setItem("lsp-settings", JSON.stringify(state.settings));
  renderOrderSummary();

  if(!configured){
    $("adminMessage").textContent = "บันทึกการตั้งค่าไว้ในเครื่องแล้ว ♡";
    toast("บันทึกการตั้งค่าแล้วค่ะ");
    return;
  }

  const { error } = await supabase.from("store_settings").upsert(payload);
  if(error){
    $("adminMessage").textContent = "บันทึกในเครื่องแล้ว (ฐานข้อมูลแจ้ง: " + error.message + ")";
    toast("บันทึกการตั้งค่าในเครื่องแล้วค่ะ");
    return;
  }
  $("adminMessage").textContent = "บันทึกการตั้งค่าโปรโมชันและค่าจัดส่งแล้ว ♡";
  toast("บันทึกการตั้งค่าแล้วค่ะ");
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
  if(logged){
    $("adminWelcome").textContent=`เข้าสู่ระบบ: ${state.user.email}`;
    populateSettingsForm();
    renderAdminProducts();
  }
}
function resetForm(){
  $("productForm").reset();$("productId").value="";$("formTitle").textContent="เพิ่มหนังสือเล่มใหม่";
  if($("pBoxSize")) $("pBoxSize").value="B";
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
    return `<div class="admin-product">${imgs.length?`<img src="${esc(imgs[0])}" alt="">`:'<div class="cover-placeholder">♡</div>'}<div class="admin-product-main"><strong>${esc(p.code)} · ${esc(p.title)}</strong><small>${money(p.price)} · ${statusText(p.status)} · กล่อง ${esc(p.box_size || "B")}</small></div><button data-edit="${p.id}">แก้ไข</button><button data-delete="${p.id}">ลบ</button></div>`;
  }).join(""):'<p class="tiny-note">ยังไม่มีหนังสือ เพิ่มเล่มแรกของคุณได้เลย</p>';
  $("adminProducts").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
  $("adminProducts").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
}
function editProduct(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  $("productId").value=p.id;$("pCode").value=p.code;$("pTitle").value=p.title;$("pAuthor").value=p.author||"";
  $("pPrice").value=p.price??"";
  if($("pPages")) $("pPages").value=p.page_count??200;
  if($("pBoxSize")) $("pBoxSize").value=p.box_size||"B";
  $("pCategory").value=p.category||"";$("pStatus").value=p.status;
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
    page_count:Number($("pPages")?.value||200),
    box_size:$("pBoxSize")?.value||"B",
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
  initProvinceDatalist();
  expireCartIfNeeded();
  saveCart();
  syncProvinceUI();
  setInterval(()=>{
    expireCartIfNeeded();
    updateTimerUI();
  }, 1000);

  if(configured){
    const {data}=await supabase.auth.getSession();state.user=data.session?.user||null;renderAdminState();
    supabase.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;renderAdminState();});
    await loadSettings();
    await loadProducts();
  }else{
    $("bookGrid").innerHTML='<div class="empty-state">ชั้นหนังสือกำลังเตรียมเปิดให้บริการ ♡<br>เชื่อม Supabase ตามคู่มือเพื่อเริ่มเพิ่มสินค้า</div>';
    $("loginView").hidden=false;
  }
}
init();
