import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
  1) Create a Supabase project.
  2) Paste your Project URL and anon/public key below.
  3) Run supabase-schema.sql in Supabase SQL Editor.
*/
const SUPABASE_URL = "https://tfcjnuumibxnukitshts.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tn_VDS-a0xb-ZBnOEK3Azg__4Ib87eK";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const state = { products: [], cart: new Set(JSON.parse(localStorage.getItem("lsp-cart") || "[]")), user: null, editingImage: null, selectedFile: null };
const money = (n) => `${Number(n || 0).toLocaleString("th-TH")} บาท`;
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusText = (s) => ({available:"พร้อมจำหน่าย",reserved:"จองแล้ว",sold:"ขายแล้ว"}[s] || s);
const toast = (msg) => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2400); };
const openPanel = (id) => { $(id).classList.add("open"); $(id).setAttribute("aria-hidden","false"); };
const closePanel = (id) => { $(id).classList.remove("open"); $(id).setAttribute("aria-hidden","true"); };
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closePanel(b.dataset.close)));
$("homeLink").addEventListener("click",e=>{e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});});
$("cartOpen").addEventListener("click",()=>{renderCart();openPanel("cartPanel");});
$("adminOpen").addEventListener("click",()=>{openPanel("adminPanel");renderAdminState();});
$("searchInput").addEventListener("input",renderBooks);
$("categoryFilter").addEventListener("change",renderBooks);
$("statusFilter").addEventListener("change",renderBooks);
$("copyOrder").addEventListener("click",copyOrder);
$("clearCart").addEventListener("click",()=>{state.cart.clear();saveCart();renderCart();renderBooks();toast("ล้างรายการแล้ว");});
$("loginButton").addEventListener("click",login);
$("logoutButton").addEventListener("click",logout);
$("productForm").addEventListener("submit",saveProduct);
$("resetForm").addEventListener("click",resetForm);
$("pImage").addEventListener("change",previewFile);

function saveCart(){localStorage.setItem("lsp-cart",JSON.stringify([...state.cart]));$("cartCount").textContent=state.cart.size;}
function cover(p){return p.image_url ? `<img src="${esc(p.image_url)}" alt="ปกหนังสือ ${esc(p.title)}" loading="lazy">` : `<div class="cover-placeholder">La<br>Seconde<br>Page ♡</div>`;}
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
  $("cartItems").innerHTML=items.length?items.map(p=>`<div class="cart-row">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<div class="cart-thumb"></div>'}<div><strong>${esc(p.title)}</strong><small>${esc(p.code)} · ${esc(p.category||"")}</small></div><button class="remove-item" data-remove="${p.id}" aria-label="นำออก">×</button></div>`).join(""):'<div class="empty-state">ยังไม่มีหนังสือในรายการที่เลือก ♡</div>';
  $("cartItems").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>toggleCart(b.dataset.remove)));
}
function copyOrder(){
  const items=state.products.filter(p=>state.cart.has(p.id)&&p.status==="available");
  if(!items.length){toast("ยังไม่มีหนังสือที่เลือก");return;}
  const text="สวัสดีค่ะ สนใจหนังสือจาก La Seconde Page ค่ะ\n"+items.map((p,i)=>`${i+1}. ${p.code} — ${p.title}`).join("\n")+"\nรบกวนตรวจสอบสินค้าและแจ้งยอดรวมพร้อมค่าส่งด้วยนะคะ ♡";
  if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast("คัดลอกรายการแล้ว นำไปส่งทาง LINE ได้เลย")).catch(()=>toast("ไม่สามารถคัดลอกได้ กรุณาแคปหน้าจอแทน"));}
  else toast("กรุณาแคปหน้าจอรายการแล้วส่งให้ร้านนะคะ");
}
function showDetail(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  alert(`${p.title}\nรหัส: ${p.code}\nผู้เขียน: ${p.author||"-"}\nหมวดหมู่: ${p.category||"-"}\nราคา: ${money(p.price)}\nสถานะ: ${statusText(p.status)}\n\nสภาพและตำหนิ:\n${p.condition||"-"}\n\nรายละเอียดเพิ่มเติม:\n${p.description||"-"}`);
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
  $("productForm").reset();$("productId").value="";$("formTitle").textContent="เพิ่มหนังสือเล่มใหม่";state.editingImage=null;state.selectedFile=null;$("imagePreview").textContent="ยังไม่ได้เลือกรูป";
}
function previewFile(){
  const file=$("pImage").files[0];state.selectedFile=file||null;
  if(file){const url=URL.createObjectURL(file);$("imagePreview").innerHTML=`<img src="${url}" alt="ตัวอย่างรูปหนังสือ">`;}
}
function renderAdminProducts(){
  if(!state.user)return;
  $("adminProductCount").textContent=`${state.products.length} เล่ม`;
  $("adminProducts").innerHTML=state.products.length?state.products.map(p=>`<div class="admin-product">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<div class="cover-placeholder">♡</div>'}<div class="admin-product-main"><strong>${esc(p.code)} · ${esc(p.title)}</strong><small>${money(p.price)} · ${statusText(p.status)}</small></div><button data-edit="${p.id}">แก้ไข</button><button data-delete="${p.id}">ลบ</button></div>`).join(""):'<p class="tiny-note">ยังไม่มีหนังสือ เพิ่มเล่มแรกของคุณได้เลย</p>';
  $("adminProducts").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));
  $("adminProducts").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProduct(b.dataset.delete)));
}
function editProduct(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  $("productId").value=p.id;$("pCode").value=p.code;$("pTitle").value=p.title;$("pAuthor").value=p.author||"";
  $("pPrice").value=p.price??"";$("pCategory").value=p.category||"";$("pStatus").value=p.status;
  $("pCondition").value=p.condition||"";$("pDescription").value=p.description||"";
  state.editingImage=p.image_url||null;state.selectedFile=null;$("pImage").value="";
  $("imagePreview").innerHTML=p.image_url?`<img src="${esc(p.image_url)}" alt="รูปปัจจุบัน">`:"ยังไม่มีรูป";
  $("formTitle").textContent="แก้ไขข้อมูลหนังสือ";$("productForm").scrollIntoView({behavior:"smooth"});
}
async function saveProduct(e){
  e.preventDefault();if(!state.user)return;
  const id=$("productId").value;
  const record={code:$("pCode").value.trim(),title:$("pTitle").value.trim(),author:$("pAuthor").value.trim(),price:Number($("pPrice").value||0),category:$("pCategory").value.trim(),status:$("pStatus").value,condition:$("pCondition").value.trim(),description:$("pDescription").value.trim(),image_url:state.editingImage};
  if(state.selectedFile){
    const ext=(state.selectedFile.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=`${crypto.randomUUID()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("book-images").upload(path,state.selectedFile,{upsert:false});
    if(upErr){$("adminMessage").textContent="อัปโหลดรูปไม่สำเร็จ: "+upErr.message;return;}
    record.image_url=supabase.storage.from("book-images").getPublicUrl(path).data.publicUrl;
  }
  const result=id?await supabase.from("products").update(record).eq("id",id):await supabase.from("products").insert(record);
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
