(() => {
  const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const timeFmt = t => { if(!t)return ''; const [h,m]=t.split(':').map(Number); const ap=h>=12?'PM':'AM'; return `${h%12||12}:${String(m).padStart(2,'0')} ${ap}`; };

  const dateEl=document.getElementById('availabilityDate');
  const timeline=document.getElementById('slotTimeline');
  async function loadAvailability(){
    if(!dateEl||!timeline)return;
    timeline.innerHTML='<div class="timeline-loading">Loading live availability…</div>';
    try{
      const r=await fetch(`/api/availability?venueId=${encodeURIComponent(dateEl.dataset.venue)}&date=${dateEl.value}`);const data=await r.json();
      const venueOpen=8, venueClose=22; const rows=[];
      for(let h=venueOpen;h<venueClose;h++){
        const start=`${String(h).padStart(2,'0')}:00`,end=`${String(h+1).padStart(2,'0')}:00`;
        const b=data.bookings.find(x=>x.startTime<end&&x.endTime>start);const m=data.maintenance.find(x=>x.startTime<end&&x.endTime>start);
        let cls='free', label='Available'; if(m){cls='maintenance';label=`Maintenance · ${m.reason}`}else if(b){cls=b.status==='pending'?'pending':'booked';label=`${b.status==='pending'?'Pending':'Booked'} · ${b.eventName}`}
        rows.push(`<div class="timeline-row"><span class="timeline-time">${timeFmt(start)}</span><div class="timeline-bar ${cls}">${label}</div></div>`)
      }
      timeline.innerHTML=rows.join('');
    }catch(e){timeline.innerHTML='<div class="timeline-loading">Availability could not be loaded. Refresh to try again.</div>'}
  }
  dateEl?.addEventListener('change',()=>{const b=document.getElementById('bookDate');if(b)b.value=dateEl.value;loadAvailability()});loadAvailability();

  const form=document.getElementById('bookingForm');
  if(form){
    const rate=Number(document.querySelector('.detail-copy .venue-kicker span:last-child')?.textContent.replace(/[^0-9]/g,'')||0);
    const start=document.getElementById('startTime'),end=document.getElementById('endTime'),estimate=document.getElementById('estimate'),facilityHidden=document.getElementById('facilitiesRequested');
    const update=()=>{const [sh,sm]=(start.value||'00:00').split(':').map(Number),[eh,em]=(end.value||'00:00').split(':').map(Number);let h=((eh*60+em)-(sh*60+sm))/60;estimate.textContent=h>0?money(h*rate):money(0);facilityHidden.value=[...form.querySelectorAll('.select-facilities input:checked')].map(x=>x.value).join(',')};start?.addEventListener('input',update);end?.addEventListener('input',update);form.querySelectorAll('.select-facilities input').forEach(x=>x.addEventListener('change',update));update();
  }

  const checkin=document.getElementById('checkinForm');
  const result=document.getElementById('checkinResult');
  checkin?.addEventListener('submit',async e=>{e.preventDefault();const code=new FormData(checkin).get('bookingCode');try{const r=await fetch('/admin/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingCode:code})});const d=await r.json();result.className=d.ok?'checkin-ok':'checkin-error';result.textContent=d.message;if(d.ok)checkin.reset()}catch(_){result.className='checkin-error';result.textContent='Check-in failed.'}});

  const scanBtn=document.getElementById('scanQr');
  scanBtn?.addEventListener('click',async()=>{
    if(!window.Html5Qrcode){alert('Camera scanner library is still loading. Try again in a moment.');return}
    const scanner=new Html5Qrcode('qr-reader'); document.getElementById('qr-reader').style.display='block';
    try{await scanner.start({facingMode:'environment'},{fps:10,qrbox:220},async decoded=>{const parts=decoded.split('|');const code=parts[1]||decoded;document.querySelector('#checkinForm input[name="bookingCode"]').value=code;await scanner.stop();document.getElementById('qr-reader').style.display='none';checkin?.requestSubmit()},()=>{});}catch(e){document.getElementById('qr-reader').style.display='none';alert('Camera access was unavailable. You can enter the booking code manually.')}});
})();
