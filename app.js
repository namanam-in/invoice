const STORAGE = {
  settings: "gstim_settings_v1",
  invoices: "gstim_invoices_v1"
};

const defaultSettings = {
  name: "Your Business Name",
  gstin: "",
  pan: "",
  phone: "",
  email: "",
  state: "Haryana",
  stateCode: "06",
  pincode: "",
  address: "",
  prefix: "INV-",
  nextNumber: 1,
  notes: ""
};

let settings = load(STORAGE.settings, defaultSettings);
let invoices = load(STORAGE.invoices, []);
let currentItems = [];

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2}).format(Number(n)||0);
const today = () => new Date().toISOString().slice(0,10);

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function escapeHtml(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function gstinLooksValid(gstin){
  if(!gstin) return true;
  return /^[0-9A-Z]{15}$/.test(gstin.toUpperCase());
}

function nextInvoiceNumber(){
  return `${settings.prefix || "INV-"}${String(settings.nextNumber || 1).padStart(4,"0")}`;
}

function resetInvoice(){
  $("invoiceNumber").value = nextInvoiceNumber();
  $("invoiceDate").value = today();
  $("placeOfSupply").value = settings.state || "";
  $("paymentStatus").value = "Pending";
  ["buyerName","buyerGstin","buyerPhone","buyerState","buyerAddress","buyerCity","buyerPincode","notes"].forEach(id => $(id).value = "");
  $("notes").value = settings.notes || "";
  currentItems = [{name:"",hsn:"",qty:1,unit:"PCS",rate:0,discount:0,gst:18}];
  renderItems();
  calculate();
}

function renderSeller(){
  $("sellerPreview").innerHTML = `
    <strong>${escapeHtml(settings.name)}</strong><br>
    ${escapeHtml(settings.address || "Business address not set")}<br>
    ${settings.state ? `State: ${escapeHtml(settings.state)}${settings.stateCode ? ` (${escapeHtml(settings.stateCode)})` : ""}<br>` : ""}
    ${settings.pincode ? `Pincode: ${escapeHtml(settings.pincode)}<br>` : ""}
    ${settings.gstin ? `GSTIN: <b>${escapeHtml(settings.gstin)}</b><br>` : `<span class="muted">GSTIN not configured</span><br>`}
    ${settings.pan ? `PAN: ${escapeHtml(settings.pan)}<br>` : ""}
    ${settings.phone ? `Phone: ${escapeHtml(settings.phone)}<br>` : ""}
    ${settings.email ? `Email: ${escapeHtml(settings.email)}` : ""}
  `;
}

function renderItems(){
  const body = $("itemsBody");
  body.innerHTML = currentItems.map((item,i)=>`
    <tr>
      <td><input data-i="${i}" data-k="name" value="${escapeHtml(item.name)}" placeholder="Product / service"></td>
      <td><input data-i="${i}" data-k="hsn" value="${escapeHtml(item.hsn)}" placeholder="HSN/SAC"></td>
      <td><input class="qty" type="number" min="0" step="0.001" data-i="${i}" data-k="qty" value="${item.qty}"></td>
      <td><input data-i="${i}" data-k="unit" value="${escapeHtml(item.unit)}" placeholder="PCS"></td>
      <td><input class="rate" type="number" min="0" step="0.01" data-i="${i}" data-k="rate" value="${item.rate}"></td>
      <td><input class="discount" type="number" min="0" step="0.01" data-i="${i}" data-k="discount" value="${item.discount}"></td>
      <td><select class="gst" data-i="${i}" data-k="gst">
        ${[0,5,12,18,28,40].map(r=>`<option value="${r}" ${Number(item.gst)===r?"selected":""}>${r}%</option>`).join("")}
      </select></td>
      <td class="line-taxable">${money(lineTaxable(item))}</td>
      <td><button class="remove-btn" data-remove="${i}" title="Remove item">×</button></td>
    </tr>`).join("");

  body.querySelectorAll("[data-i]").forEach(el => el.addEventListener("input", onItemChange));
  body.querySelectorAll("[data-k]").forEach(el => el.addEventListener("change", onItemChange));
  body.querySelectorAll("[data-remove]").forEach(el => el.addEventListener("click", ()=>{
    currentItems.splice(Number(el.dataset.remove),1);
    if(!currentItems.length) currentItems.push({name:"",hsn:"",qty:1,unit:"PCS",rate:0,discount:0,gst:18});
    renderItems(); calculate();
  }));
}

function onItemChange(e){
  const i = Number(e.target.dataset.i), k = e.target.dataset.k;
  let value = e.target.value;
  if(["qty","rate","discount","gst"].includes(k)) value = Number(value)||0;
  currentItems[i][k] = value;
  const row = e.target.closest("tr");
  row.querySelector(".line-taxable").textContent = money(lineTaxable(currentItems[i]));
  calculate();
}

function lineTaxable(item){
  return Math.max(0,(Number(item.qty)||0)*(Number(item.rate)||0)-(Number(item.discount)||0);
}

function isInterState(){
  const seller = (settings.state||"").trim().toLowerCase();
  const buyer = ($("buyerState").value||"").trim().toLowerCase();
  const pos = ($("placeOfSupply").value||"").trim().toLowerCase();
  if(!buyer && !pos) return false;
  const destination = buyer || pos;
  return seller && destination && seller !== destination;
}

function calculate(){
  let taxable=0,cgst=0,sgst=0,igst=0;
  const interstate = isInterState();
  currentItems.forEach(item=>{
    const base=lineTaxable(item), rate=(Number(item.gst)||0)/100;
    taxable += base;
    if(interstate) igst += base*rate;
    else { cgst += base*rate/2; sgst += base*rate/2; }
  });
  const raw = taxable+cgst+sgst+igst;
  const rounded = Math.round(raw);
  const roundOff = rounded-raw;
  $("taxableTotal").textContent=money(taxable);
  $("cgstTotal").textContent=money(cgst);
  $("sgstTotal").textContent=money(sgst);
  $("igstTotal").textContent=money(igst);
  $("roundOff").textContent=money(roundOff);
  $("grandTotal").textContent=money(rounded);
  $("amountWords").textContent=numberToWords(rounded)+" Rupees Only";
  $("supplyType").textContent=interstate ? "Inter-State — IGST" : "Intra-State — CGST + SGST";
  return {taxable,cgst,sgst,igst,roundOff,total:rounded};
}

function numberToWords(num){
  num=Math.floor(Number(num)||0);
  if(num===0) return "Zero";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function under1000(n){
    let s="";
    if(n>=100){s+=ones[Math.floor(n/100)]+" Hundred"; n%=100; if(n)s+=" ";}
    if(n>=20){s+=tens[Math.floor(n/10)]; n%=10; if(n)s+=" "+ones[n];}
    else if(n>0)s+=ones[n];
    return s;
  }
  let parts=[];
  const crore=Math.floor(num/10000000); num%=10000000;
  const lakh=Math.floor(num/100000); num%=100000;
  const thousand=Math.floor(num/1000); num%=1000;
  if(crore) parts.push(under1000(crore)+" Crore");
  if(lakh) parts.push(under1000(lakh)+" Lakh");
  if(thousand) parts.push(under1000(thousand)+" Thousand");
  if(num) parts.push(under1000(num));
  return parts.join(" ");
}

function collectInvoice(){
  const totals=calculate();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    invoiceNumber:$("invoiceNumber").value.trim(),
    date:$("invoiceDate").value,
    placeOfSupply:$("placeOfSupply").value.trim(),
    paymentStatus:$("paymentStatus").value,
    seller:{...settings},
    buyer:{
      name:$("buyerName").value.trim(),gstin:$("buyerGstin").value.trim().toUpperCase(),
      phone:$("buyerPhone").value.trim(),state:$("buyerState").value.trim(),
      address:$("buyerAddress").value.trim(),city:$("buyerCity").value.trim(),pincode:$("buyerPincode").value.trim()
    },
    items:JSON.parse(JSON.stringify(currentItems)),
    notes:$("notes").value,
    totals
  };
}

function validateInvoice(inv){
  if(!inv.buyer.name){alert("Enter the buyer/customer name.");return false;}
  if(inv.seller.gstin && !gstinLooksValid(inv.seller.gstin)){alert("Seller GSTIN should contain 15 uppercase letters/numbers.");return false;}
  if(inv.buyer.gstin && !gstinLooksValid(inv.buyer.gstin)){alert("Buyer GSTIN should contain 15 uppercase letters/numbers.");return false;}
  if(!inv.items.some(x=>x.name && lineTaxable(x)>0)){alert("Add at least one product with a valid amount.");return false;}
  return true;
}

function saveInvoice(){
  const inv=collectInvoice();
  if(!validateInvoice(inv)) return;
  const idx=invoices.findIndex(x=>x.id===inv.id);
  // Current invoice is new unless loaded from history.
  const existing=invoices.findIndex(x=>x.invoiceNumber===inv.invoiceNumber);
  if(existing>=0){
    inv.id=invoices[existing].id;
    invoices[existing]=inv;
  }else invoices.unshift(inv);
  save(STORAGE.invoices,invoices);
  if(existing<0) settings.nextNumber=(Number(settings.nextNumber)||1)+1;
  save(STORAGE.settings,settings);
  renderHistory(); updateStats();
  alert("Invoice saved successfully.");
}

function renderHistory(){
  const q=($("invoiceSearch").value||"").toLowerCase();
  const list=invoices.filter(x=>
    [x.invoiceNumber,x.buyer?.name,x.date,x.paymentStatus].join(" ").toLowerCase().includes(q)
  );
  $("historyBody").innerHTML=list.length?list.map(x=>`
    <tr>
      <td><strong>${escapeHtml(x.invoiceNumber)}</strong></td>
      <td>${escapeHtml(x.buyer?.name||"")}</td>
      <td>${escapeHtml(x.date||"")}</td>
      <td>${money(x.totals?.total||0)}</td>
      <td><span class="status ${x.paymentStatus==="Partially Paid"?"Partially":x.paymentStatus}">${escapeHtml(x.paymentStatus)}</span></td>
      <td>
        <button class="btn secondary small" data-open="${x.id}">Open</button>
        <button class="btn secondary small" data-delete="${x.id}">Delete</button>
      </td>
    </tr>`).join(""):`<tr><td colspan="6" style="text-align:center;color:#718096;padding:28px">No invoices found.</td></tr>`;
  $("historyBody").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>loadInvoice(b.dataset.open));
  $("historyBody").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{
    if(confirm("Delete this invoice?")){invoices=invoices.filter(x=>x.id!==b.dataset.delete);save(STORAGE.invoices,invoices);renderHistory();updateStats();}
  });
}

function loadInvoice(id){
  const x=invoices.find(i=>i.id===id); if(!x)return;
  $("invoiceNumber").value=x.invoiceNumber;$("invoiceDate").value=x.date;$("placeOfSupply").value=x.placeOfSupply||"";
  $("paymentStatus").value=x.paymentStatus||"Pending";
  $("buyerName").value=x.buyer.name||"";$("buyerGstin").value=x.buyer.gstin||"";$("buyerPhone").value=x.buyer.phone||"";
  $("buyerState").value=x.buyer.state||"";$("buyerAddress").value=x.buyer.address||"";$("buyerCity").value=x.buyer.city||"";$("buyerPincode").value=x.buyer.pincode||"";
  $("notes").value=x.notes||"";currentItems=JSON.parse(JSON.stringify(x.items||[]));renderItems();calculate();
  window.scrollTo({top:0,behavior:"smooth"});
}

function updateStats(){
  $("statInvoices").textContent=invoices.length;
  const sales=invoices.reduce((s,x)=>s+(Number(x.totals?.total)||0),0);
  const gst=invoices.reduce((s,x)=>s+(Number(x.totals?.cgst)||0)+(Number(x.totals?.sgst)||0)+(Number(x.totals?.igst)||0),0);
  const pending=invoices.filter(x=>x.paymentStatus!=="Paid").reduce((s,x)=>s+(Number(x.totals?.total)||0),0);
  $("statSales").textContent=money(sales);$("statGst").textContent=money(gst);$("statPending").textContent=money(pending);
}

function openSettings(){
  const map={setName:"name",setGstin:"gstin",setPan:"pan",setPhone:"phone",setEmail:"email",setState:"state",setStateCode:"stateCode",setPincode:"pincode",setAddress:"address",setPrefix:"prefix",setNextNumber:"nextNumber",setNotes:"notes"};
  Object.entries(map).forEach(([id,k])=>$(id).value=settings[k]??"");
  $("settingsModal").classList.remove("hidden");
}
function closeSettings(){$("settingsModal").classList.add("hidden")}
function saveSettings(){
  const ids={setName:"name",setGstin:"gstin",setPan:"pan",setPhone:"phone",setEmail:"email",setState:"state",setStateCode:"stateCode",setPincode:"pincode",setAddress:"address",setPrefix:"prefix",setNextNumber:"nextNumber",setNotes:"notes"};
  Object.entries(ids).forEach(([id,k])=>settings[k]=["nextNumber"].includes(k)?Number($(id).value)||1:$(id).value.trim());
  settings.gstin=settings.gstin.toUpperCase();settings.pan=settings.pan.toUpperCase();
  if(!settings.name){alert("Business name is required.");return}
  if(settings.gstin && !gstinLooksValid(settings.gstin)){alert("Invalid GSTIN format. GSTIN must be 15 letters/numbers.");return}
  save(STORAGE.settings,settings);renderSeller();closeSettings();resetInvoice();
}

function printInvoice(){
  const inv=collectInvoice(); if(!validateInvoice(inv))return;
  const t=inv.totals, inter=isInterState();
  const rows=inv.items.filter(x=>x.name).map((x,i)=>`
    <tr><td>${i+1}</td><td>${escapeHtml(x.name)}<br><small>${escapeHtml(x.unit)}</small></td><td>${escapeHtml(x.hsn)}</td>
    <td>${x.qty}</td><td>${money(x.rate)}</td><td>${money(x.discount)}</td><td>${x.gst}%</td><td>${money(lineTaxable(x))}</td></tr>`).join("");
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(inv.invoiceNumber)}</title>
  <style>
  @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:22px;margin:0}h2{font-size:14px;margin:0 0 5px}.muted{color:#666}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:14px}.right{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.box{border:1px solid #ccc;padding:10px;min-height:90px}.label{font-size:9px;text-transform:uppercase;color:#777;font-weight:bold;margin-bottom:5px}table{width:100%;border-collapse:collapse}th{background:#f2f2f2}th,td{border:1px solid #ccc;padding:7px;text-align:left}td:nth-child(n+4),th:nth-child(n+4){text-align:right}.bottom{display:grid;grid-template-columns:1fr 310px;gap:16px;margin-top:15px}.totals{border:1px solid #ccc;padding:10px}.tr{display:flex;justify-content:space-between;padding:5px 0}.grand{border-top:2px solid #111;margin-top:5px;padding-top:8px;font-size:16px;font-weight:bold}.words{margin-top:12px;border:1px solid #ccc;padding:9px}.footer{margin-top:18px;display:flex;justify-content:space-between}.sign{width:180px;text-align:center;padding-top:35px;border-top:1px solid #aaa}.notes{white-space:pre-wrap}.small{font-size:9px}</style></head><body>
  <div class="head"><div><h1>TAX INVOICE</h1><div class="muted">Original for recipient</div></div><div class="right"><strong>${escapeHtml(inv.seller.name)}</strong><br>${escapeHtml(inv.seller.address)}<br>${escapeHtml(inv.seller.state)} ${escapeHtml(inv.seller.pincode)}<br><strong>GSTIN: ${escapeHtml(inv.seller.gstin||"—")}</strong></div></div>
  <div class="grid"><div class="box"><div class="label">Bill From</div><strong>${escapeHtml(inv.seller.name)}</strong><br>${escapeHtml(inv.seller.address)}<br>${escapeHtml(inv.seller.phone)} ${escapeHtml(inv.seller.email)}<br>GSTIN: ${escapeHtml(inv.seller.gstin||"—")}<br>PAN: ${escapeHtml(inv.seller.pan||"—")}</div>
  <div class="box"><div class="label">Bill To</div><strong>${escapeHtml(inv.buyer.name)}</strong><br>${escapeHtml(inv.buyer.address)} ${escapeHtml(inv.buyer.city)} ${escapeHtml(inv.buyer.pincode)}<br>State: ${escapeHtml(inv.buyer.state)}<br>GSTIN: ${escapeHtml(inv.buyer.gstin||"Unregistered")}</div></div>
  <div class="grid"><div class="box"><div class="label">Invoice Details</div>Invoice No: <strong>${escapeHtml(inv.invoiceNumber)}</strong><br>Date: ${escapeHtml(inv.date)}<br>Place of Supply: ${escapeHtml(inv.placeOfSupply||inv.buyer.state)}</div><div class="box"><div class="label">Supply Type</div><strong>${inter?"Inter-State — IGST":"Intra-State — CGST + SGST"}</strong><br>Status: ${escapeHtml(inv.paymentStatus)}</div></div>
  <table><thead><tr><th>#</th><th>Product / Service</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Discount</th><th>GST</th><th>Taxable Value</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="bottom"><div><div class="box"><div class="label">Notes / Terms</div><div class="notes">${escapeHtml(inv.notes||"Thank you for your business.")}</div></div><div class="words"><div class="label">Amount in Words</div>${escapeHtml(numberToWords(t.total))} Rupees Only</div></div>
  <div class="totals"><div class="tr"><span>Taxable Amount</span><strong>${money(t.taxable)}</strong></div><div class="tr"><span>CGST</span><strong>${money(t.cgst)}</strong></div><div class="tr"><span>SGST</span><strong>${money(t.sgst)}</strong></div><div class="tr"><span>IGST</span><strong>${money(t.igst)}</strong></div><div class="tr"><span>Round Off</span><strong>${money(t.roundOff)}</strong></div><div class="tr grand"><span>Grand Total</span><strong>${money(t.total)}</strong></div></div></div>
  <div class="footer"><div class="small">This is a computer-generated invoice.</div><div class="sign">Authorized Signatory<br>${escapeHtml(inv.seller.name)}</div></div>
  <script>window.onload=()=>window.print()<\/script></body></html>`;
  const w=window.open("","_blank","width=900,height=900"); if(!w){alert("Allow pop-ups to print/download the invoice.");return}
  w.document.write(html);w.document.close();
}

$("settingsBtn").onclick=openSettings;$("closeSettings").onclick=closeSettings;$("cancelSettings").onclick=closeSettings;$("saveSettings").onclick=saveSettings;
$("newInvoiceBtn").onclick=resetInvoice;$("addItemBtn").onclick=()=>{currentItems.push({name:"",hsn:"",qty:1,unit:"PCS",rate:0,discount:0,gst:18});renderItems();calculate()};
$("saveInvoiceBtn").onclick=saveInvoice;$("downloadBtn").onclick=printInvoice;$("invoiceSearch").oninput=renderHistory;
["buyerState","placeOfSupply"].forEach(id=>$(id).addEventListener("input",calculate));

renderSeller();resetInvoice();renderHistory();updateStats();
