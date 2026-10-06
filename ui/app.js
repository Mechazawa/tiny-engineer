var SERVO_DEFAULT_RANGES=[[60,130],[40,130],[45,135],[35,125],[40,130]];
var SERVO_RANGES=[[60,130],[40,130],[45,135],[35,125],[40,130]];
var SETUP_STEPS=[{id:"servos",title:"Servos"},{id:"oled",title:"Screen"},{id:"led",title:"RGB mapping"},{id:"speaker",title:"Speaker"},{id:"network",title:"Network"}];
var RGB_ORDERS=["RGB","RBG","GRB","GBR","BRG","BGR"];
var SETUP_JOINT_COPY=[
  "Pitch only. Watch cable slack to the head. Stop before the head hits the neck piece. Down is toward the laptop; up is away.",
  "Yaw left and right. Stop when the cables pull taut. Do not twist until the loom binds.",
  "Lowest is forearm horizontal. Highest is upper arm horizontal. On this servo, higher angle is up.",
  "Same physical stops, inverted scale: higher angle is down. Physical lowest (forearm horizontal) is toward the high end of the bar; physical highest (upper arm horizontal) is toward the low end.",
  "Rotate until the right hand sits over the bell at the extreme. Prefer a band symmetric about 90\u00b0 (hint only \u2014 stock 40\u2013130 is fine)."
];
var setupStepIndex=0;
var setupServoPhase="horns";
var setupCalibJoint=0;
var setupCalibDeg=90;
var setupCalibDegs=[90,90,90,90,90];
var setupCalibRanges=[[60,130],[40,130],[45,135],[35,125],[40,130]];
var setupRgbOrder="GRB";
var setupOledRotate180=false;
var setupLedLooks=["G","R","B"];
var setupLedRemapOpen=false;
var TOKEN_KEY="te_access_token";
var ACCESS_TOKEN_MASK="********";
var accessTokenConfigured=false;
var accessTokenMaskActive=false;
var accessTokenClearPending=false;
var busy=false;
var healthTimer=null;
var lastHealthUptimeMs=0;
var uiUnlocked=false;
var provisioningMode=false;
var wifiConfigured=false;
var statusEl=document.getElementById("status");
function getStoredToken(){
  try{return sessionStorage.getItem(TOKEN_KEY)||"";}catch(e){return"";}
}
function setStoredToken(token){
  try{
    if(token)sessionStorage.setItem(TOKEN_KEY,token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }catch(e){}
}
function apiFetch(path,opts){
  opts=opts||{};
  var headers=Object.assign({},opts.headers||{});
  var token=getStoredToken();
  if(token)headers["Authorization"]="Bearer "+token;
  return fetch(path,Object.assign({},opts,{headers:headers}));
}
function setStatus(msg,type){
  statusEl.textContent=msg;
  statusEl.className="show"+(type?" "+type:"");
}
function clearStatus(){
  statusEl.className="";
  statusEl.textContent="";
}
function setBusy(on){
  busy=on;
  document.querySelectorAll(".btn,[type=submit],.servo-slider").forEach(function(b){b.disabled=on;});
}
function showAuthGate(show){
  document.getElementById("auth-gate").classList.toggle("show",show);
  document.getElementById("reboot-gate").classList.remove("show");
  document.body.classList.toggle("locked",show);
  if(show){
    document.getElementById("auth-error").classList.remove("show");
    document.getElementById("auth-token").value="";
    document.getElementById("auth-token").focus();
  }
}
function showRebootGate(show){
  document.getElementById("reboot-gate").classList.toggle("show",show);
  document.getElementById("auth-gate").classList.remove("show");
  document.body.classList.toggle("locked",show);
  if(show){
    uiUnlocked=false;
    stopHealthPolling();
  }
}
function enterApp(){
  uiUnlocked=true;
  showAuthGate(false);
  showRebootGate(false);
  syncSetupUi(function(){
    if(provisioningMode||!wifiConfigured){
      resetSetupWizard();
      showPage("/config");
    }else{
      showPage(location.pathname);
    }
    loadSettings();
  });
}
function setFwVersion(j){
  var el=document.getElementById("fw-version");
  if(!el)return;
  if(j&&j.ok&&j.version)el.textContent="Firmware "+j.version;
}
function syncSetupUi(done){
  apiFetch("/health").then(function(r){return r.json();}).then(function(j){
    if(j.ok){
      setFwVersion(j);
      provisioningMode=!!j.provisioning;
      wifiConfigured=!!j.wifi_configured;
      var inSetup=provisioningMode||!wifiConfigured;
      document.body.classList.toggle("setup-mode",inSetup);
      var title=document.getElementById("config-page-title");
      var desc=document.getElementById("config-page-desc");
      if(title)title.textContent=inSetup?"WiFi setup":"Config";
      if(desc){
        desc.textContent=inSetup
          ?"Calibrate servos, set screen orientation, check the LED and speaker, then enter a device name and your home WiFi network. The robot tests the connection before saving."
          :"Saved to flash. Most changes apply right away.";
      }
      if(inSetup)applySetupWizardUi();
    }
    if(done)done();
  }).catch(function(){if(done)done();});
}
function syncWifiStatusFromSettings(j){
  var status=document.getElementById("wifi-config-status");
  if(!status)return;
  status.textContent="Enter the network name and password for the WiFi you want the robot to join.";
}
function cloneRanges(src){
  return src.map(function(r){return [r[0],r[1]];});
}
function applyServoRangesFromSettings(j){
  if(!j||!j.servo_mins||!j.servo_maxs||j.servo_mins.length!==5||j.servo_maxs.length!==5)return;
  for(var i=0;i<5;i++)SERVO_RANGES[i]=[j.servo_mins[i],j.servo_maxs[i]];
}
function applyRgbOrderFromSettings(j){
  if(j&&typeof j.rgb_order==="string"&&RGB_ORDERS.indexOf(j.rgb_order)>=0){
    setupRgbOrder=j.rgb_order;
  }
  applyRgbOrder(setupRgbOrder);
}
function applyOledRotateFromSettings(j){
  if(j&&typeof j.oled_rotate_180==="boolean"){
    setupOledRotate180=j.oled_rotate_180;
  }
}
function setupStepId(){
  return SETUP_STEPS[setupStepIndex].id;
}
function setSetupStep(id){
  for(var i=0;i<SETUP_STEPS.length;i++){
    if(SETUP_STEPS[i].id===id){
      setupStepIndex=i;
      return;
    }
  }
}
function enterSetupOledStep(){
  apiFetch("/setup/oled?rotate_180="+(setupOledRotate180?1:0),{method:"POST"}).catch(function(){});
}
function leaveSetupOledStep(){
  apiFetch("/setup/oled",{method:"POST"}).catch(function(){});
}
function applyRgbOrder(order){
  if(RGB_ORDERS.indexOf(order)<0)order="GRB";
  setupLedLooks=[order.charAt(0),order.charAt(1),order.charAt(2)];
}
function rgbOrderFromLooks(){
  return setupLedLooks.join("");
}
function ledMappingValid(){
  return RGB_ORDERS.indexOf(rgbOrderFromLooks())>=0;
}
function renderLedMap(){
  var map=document.getElementById("setup-led-map");
  if(!map)return;
  map.innerHTML="";
  for(var i=0;i<3;i++){
    var ch=setupLedLooks[i];
    var wrap=document.createElement("div");
    wrap.className="led-chip-wrap";
    var chip=document.createElement("div");
    chip.className="led-chip "+ch;
    var letter=document.createElement("span");
    letter.className="led-chip-letter";
    letter.textContent=ch;
    wrap.appendChild(chip);
    wrap.appendChild(letter);
    map.appendChild(wrap);
  }
}
function updateLedLooksUi(){
  document.querySelectorAll(".led-looks").forEach(function(row){
    var byte=parseInt(row.getAttribute("data-led-byte"),10);
    var picked=setupLedLooks[byte];
    row.querySelectorAll("[data-look]").forEach(function(btn){
      btn.classList.toggle("active",btn.getAttribute("data-look")===picked);
    });
  });
  renderLedMap();
}
function releaseSetupLed(){
  apiFetch("/setup/led?byte=off",{method:"POST"}).catch(function(){});
}
function setupLedPreview(query){
  apiFetch("/setup/led?"+query,{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
    .then(function(res){
      if(res.ok&&res.data.ok!==false){
        clearStatus();
      }else{
        setStatus(res.data.error||"LED preview failed","err");
      }
    })
    .catch(function(){setStatus("Network error","err");});
}
function setupLedTestColor(ch){
  var order=ledMappingValid()?rgbOrderFromLooks():setupRgbOrder;
  setupLedPreview("color="+encodeURIComponent(ch)+"&rgb_order="+encodeURIComponent(order));
}
function resetSetupWizard(){
  setupStepIndex=0;
  setupServoPhase="horns";
  setupCalibJoint=0;
  setupCalibDeg=90;
  setupCalibDegs=[90,90,90,90,90];
  setupCalibRanges=cloneRanges(SERVO_RANGES);
  applyRgbOrder(setupRgbOrder);
  setupLedRemapOpen=false;
  releaseSetupLed();
  applySetupWizardUi();
}
function calibRangesValid(){
  for(var i=0;i<5;i++){
    if(!(setupCalibRanges[i][0]<setupCalibRanges[i][1]))return false;
  }
  return true;
}
function applySetupWizardUi(){
  var total=SETUP_STEPS.length;
  var step=setupStepIndex;
  var last=total-1;
  var id=setupStepId();
  var horns=setupServoPhase==="horns";
  var nextLabel={servos:"Next: Screen",oled:"Next: RGB mapping",led:"Next: Speaker",speaker:"Next: Network"};
  document.getElementById("setup-progress-label").textContent="Step "+(step+1)+" of "+total+" \u00b7 "+SETUP_STEPS[step].title;
  document.getElementById("setup-progress-bar").style.width=((step+1)/total*100)+"%";
  document.getElementById("setup-step-servos").hidden=id!=="servos";
  document.getElementById("setup-step-oled").hidden=id!=="oled";
  document.getElementById("setup-step-led").hidden=id!=="led";
  document.getElementById("setup-step-speaker").hidden=id!=="speaker";
  document.getElementById("setup-step-network").hidden=id!=="network";
  document.getElementById("setup-phase-horns").hidden=id!=="servos"||!horns;
  document.getElementById("setup-phase-ranges").hidden=id!=="servos"||horns;
  document.getElementById("setup-footer").hidden=id==="servos"&&horns;
  document.getElementById("setup-back").hidden=id==="servos"&&horns;
  document.getElementById("setup-next").hidden=step===last||(id==="servos"&&horns);
  document.getElementById("setup-next").textContent=nextLabel[id]||"Next";
  if(id==="servos"){
    document.getElementById("setup-next").disabled=!calibRangesValid();
  }else if(id==="led"){
    document.getElementById("setup-next").disabled=!ledMappingValid();
    document.getElementById("setup-led-remap").hidden=!setupLedRemapOpen;
    if(setupLedRemapOpen)updateLedLooksUi();
  }else{
    document.getElementById("setup-next").disabled=false;
  }
  if(id==="servos"&&!horns)updateCalibUi();
  if(id==="network"){
    var ssidField=document.getElementById("config-wifi-ssid");
    if(ssidField)ssidField.focus();
  }
}
function setupCalibAngle(){
  return setupCalibDeg;
}
function setSetupCalibAngle(v){
  var n=parseInt(v,10);
  if(isNaN(n))n=90;
  if(n<0)n=0;
  if(n>180)n=180;
  setupCalibDeg=n;
  setupCalibDegs[setupCalibJoint]=n;
  document.getElementById("setup-calib-angle").textContent=String(n);
  document.getElementById("setup-calib-slider").value=n;
}
function nudgeCalib(delta){
  moveCalib(setupCalibDeg+delta);
}
function moveCalib(target){
  var prev=setupCalibDeg;
  var next=Math.max(0,Math.min(180,target));
  if(busy||next===prev){
    setSetupCalibAngle(prev);
    return;
  }
  setSetupCalibAngle(next);
  setupPostServo("index="+setupCalibJoint+"&angle="+next).then(function(res){
    if(!res.ok||res.data.ok===false)setSetupCalibAngle(prev);
  });
}
function updateCalibUi(){
  var r=setupCalibRanges[setupCalibJoint];
  var band=document.getElementById("setup-calib-band");
  band.style.left=(r[0]/180*100)+"%";
  band.style.width=((r[1]-r[0])/180*100)+"%";
  document.getElementById("setup-min-label").textContent=r[0];
  document.getElementById("setup-max-label").textContent=r[1];
  document.getElementById("setup-joint-copy").textContent=SETUP_JOINT_COPY[setupCalibJoint];
  document.querySelectorAll("#setup-joint-tabs [data-joint]").forEach(function(btn){
    btn.classList.toggle("active",parseInt(btn.getAttribute("data-joint"),10)===setupCalibJoint);
  });
  var sym=document.getElementById("setup-body-sym");
  if(setupCalibJoint===4){
    sym.hidden=false;
    sym.textContent="Distance below 90\u00b0: "+(90-r[0])+"\u00b0 \u00b7 above 90\u00b0: "+(r[1]-90)+"\u00b0";
  }else{
    sym.hidden=true;
  }
  document.getElementById("setup-next").disabled=!calibRangesValid();
  setSetupCalibAngle(setupCalibDeg);
}
function setupPostServo(query){
  setBusy(true);
  setStatus("Moving servos\u2026","loading");
  return apiFetch("/setup/servo?"+query,{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
    .then(function(res){
      if(res.ok&&res.data.ok!==false){
        clearStatus();
      }else{
        setStatus(res.data.error||"Move failed","err");
      }
      return res;
    })
    .catch(function(){
      setStatus("Network error","err");
      return {ok:false,data:{}};
    })
    .finally(function(){setBusy(false);});
}
function selectCalibJoint(idx){
  setupCalibJoint=idx;
  setSetupCalibAngle(setupCalibDegs[idx]);
  updateCalibUi();
}
function showPage(path){
  if(!uiUnlocked)return;
  var map={"/":"view-home","/animations":"view-animations","/servo":"view-servo","/tests":"view-tests","/config":"view-config","/api":"view-api"};
  var id=map[path]||"view-home";
  document.querySelectorAll(".view").forEach(function(v){v.classList.remove("active");});
  document.getElementById(id).classList.add("active");
  document.querySelectorAll("nav a").forEach(function(a){
    a.classList.toggle("active",a.getAttribute("data-nav")===path||(path==="/"&&a.getAttribute("data-nav")==="/"));
  });
  if(id==="view-animations") refreshAnim();
  if(id==="view-config"||id==="view-servo") loadSettings();
  if(id==="view-home") startHealthPolling();
  else stopHealthPolling();
}
function startHealthPolling(){
  stopHealthPolling();
  loadHealth();
  healthTimer=setInterval(loadHealth,1000);
}
function stopHealthPolling(){
  if(healthTimer){clearInterval(healthTimer);healthTimer=null;}
}
function apiPost(path){
  if(busy)return Promise.reject();
  setBusy(true);
  setStatus("Running\u2026","loading");
  return apiFetch(path,{method:"POST"}).then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
  .then(function(res){
    if(res.ok&&res.data.ok!==false){
      setStatus("Done.","ok");
    }else{
      setStatus(res.data.error||"Request failed","err");
    }
    return res;
  }).catch(function(){
    setStatus("Network error","err");
  }).finally(function(){setBusy(false);});
}
function refreshAnim(){
  apiFetch("/anim").then(function(r){return r.json();}).then(function(j){
    if(j.ok) document.querySelector("#anim-current strong").textContent=j.animation;
  }).catch(function(){});
}
function formatUptime(ms){
  var s=Math.floor(ms/1000);
  if(s<60)return s+" s";
  var m=Math.floor(s/60);s%=60;
  if(m<60)return m+" min "+s+" s";
  var h=Math.floor(m/60);m%=60;
  if(h<24)return h+" h "+m+" min";
  var d=Math.floor(h/24);h%=24;
  return d+" d "+h+" h";
}
function formatBytes(n){
  if(n>=1048576)return(n/1048576).toFixed(1)+" MB";
  if(n>=1024)return Math.round(n/1024)+" KB";
  return n+" B";
}
function loadHealth(){
  apiFetch("/health").then(function(r){return r.json();}).then(function(j){
    var el=document.getElementById("health-info");
    if(!j.ok){el.textContent="Could not load status.";return;}
    setFwVersion(j);
    if(j.uptime_ms!=null)lastHealthUptimeMs=j.uptime_ms;
    var ip=j.wifi&&j.wifi.connected?j.wifi.ip:"offline";
    var heapPct=j.heap_size?Math.round((1-j.free_heap/j.heap_size)*100):0;
    var line="IP: "+ip+" \u00b7 Uptime: "+formatUptime(j.uptime_ms)+" \u00b7 Heap: "+heapPct+"% used ("+formatBytes(j.free_heap)+" free)";
    if(typeof j.cpu_temp_c==="number")line+=" \u00b7 Temp: "+j.cpu_temp_c.toFixed(1)+" \u00b0C";
    if(j.version)line+=" \u00b7 "+j.version;
    el.textContent=line;
  }).catch(function(){
    document.getElementById("health-info").textContent="Could not load status.";
  });
}
function currentServoRange(){
  var idx=parseInt(document.getElementById("servo-index").value,10);
  return SERVO_RANGES[idx]||SERVO_RANGES[0];
}
function currentServoMid(){
  var r=currentServoRange();
  return (r[0]+r[1])/2;
}
function bindServoInputs(){
  var r=currentServoRange();
  var slider=document.getElementById("servo-slider");
  var num=document.getElementById("servo-angle");
  slider.min=r[0];
  slider.max=r[1];
  num.min=r[0];
  num.max=r[1];
  var v=parseFloat(num.value);
  if(isNaN(v)||v<r[0]||v>r[1])v=currentServoMid();
  slider.value=v;
  num.value=v;
  document.getElementById("servo-scale-min").textContent=r[0]+"\u00b0";
  document.getElementById("servo-scale-mid").textContent=Math.round(currentServoMid())+"\u00b0";
  document.getElementById("servo-scale-max").textContent=r[1]+"\u00b0";
}
function updateServoRangeHint(){
  var r=currentServoRange();
  var angle=parseFloat(document.getElementById("servo-angle").value);
  var hint=document.getElementById("servo-range-hint");
  var inRange=!isNaN(angle)&&angle>=r[0]&&angle<=r[1];
  if(inRange){
    hint.textContent="Safe range: "+r[0]+"\u2013"+r[1]+"\u00b0";
    hint.classList.remove("warn");
  }else{
    hint.textContent="Outside safe range \u2014 firmware clamps to "+r[0]+"\u2013"+r[1]+"\u00b0";
    hint.classList.add("warn");
  }
}
function updateServoHint(){
  bindServoInputs();
  var band=document.getElementById("servo-safe-band");
  band.style.left="0%";
  band.style.width="100%";
  updateServoRangeHint();
}
function setServoAngle(v){
  document.getElementById("servo-slider").value=v;
  document.getElementById("servo-angle").value=v;
  updateServoRangeHint();
}
function moveServo(){
  if(busy)return;
  var idx=document.getElementById("servo-index").value;
  var angle=document.getElementById("servo-angle").value;
  setBusy(true);
  setStatus("Moving servo\u2026","loading");
  apiFetch("/test/servo?index="+idx+"&angle="+angle,{method:"POST"})
  .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
  .then(function(res){
    if(res.ok&&res.data.ok!==false){
      setStatus("Servo "+idx+" moved to "+angle+"\u00b0.","ok");
    }else{
      setStatus(res.data.error||"Move failed","err");
    }
  }).catch(function(){setStatus("Network error","err");})
  .finally(function(){setBusy(false);});
}
document.getElementById("servo-slider").addEventListener("input",function(){
  document.getElementById("servo-angle").value=this.value;
  updateServoRangeHint();
});
document.getElementById("servo-angle").addEventListener("input",function(){
  document.getElementById("servo-slider").value=this.value;
  updateServoRangeHint();
});
document.getElementById("servo-index").addEventListener("change",updateServoHint);
document.getElementById("servo-center").addEventListener("click",function(){
  setServoAngle(currentServoMid());
  moveServo();
});
document.getElementById("servo-form").addEventListener("submit",function(e){
  e.preventDefault();
  moveServo();
});
function setConfigVolume(v){
  var n=parseInt(v,10);
  if(isNaN(n))n=70;
  if(n<0)n=0;
  if(n>100)n=100;
  document.getElementById("config-volume").value=n;
  document.getElementById("config-volume-slider").value=n;
  document.getElementById("config-volume-label").textContent=n+"%";
}
function syncAccessTokenUi(){
  var field=document.getElementById("config-access-token");
  var toggle=document.getElementById("config-access-token-toggle");
  var status=document.getElementById("config-access-token-status");
  if(accessTokenClearPending){
    field.value="";
    field.disabled=true;
    field.placeholder="Token will be removed on Save";
    toggle.hidden=false;
    toggle.textContent="Undo";
    status.textContent="Will remove on save";
  }else if(accessTokenConfigured){
    field.disabled=false;
    field.placeholder="Enter a new token to replace";
    if(accessTokenMaskActive)field.value=ACCESS_TOKEN_MASK;
    toggle.hidden=false;
    toggle.textContent="Remove token";
    status.textContent="Auth enabled \u2014 click field to replace";
  }else{
    field.disabled=false;
    if(!accessTokenMaskActive)field.value="";
    field.placeholder="Enter access token";
    toggle.hidden=true;
    status.textContent="Auth disabled";
  }
}
function updateWelcomeMotionHint(){
  var loading=document.getElementById("config-loading").value;
  var welcome=document.getElementById("config-welcome").checked;
  document.getElementById("config-welcome-motion-hint").style.display=(loading==="sleep_inertia"&&!welcome)?"block":"none";
}
function buildSaveMessage(prevHost,prevLoading,res){
  var savedHost=res.data.hostname||prevHost;
  var savedLoading=res.data.loading==="sleep_inertia"?"sleep_inertia":"progress";
  var hostChanged=savedHost!==prevHost||!!res.data.reboot_required;
  var loadingChanged=savedLoading!==prevLoading;
  if(!hostChanged&&!loadingChanged)return "Settings saved.";
  if(hostChanged&&loadingChanged)return "Saved. Hostname and loading screen apply after reboot.";
  if(hostChanged)return "Saved. Hostname applies after reboot.";
  return "Saved. Loading screen applies after reboot.";
}
function setAccessTokenFromServer(tokenSet){
  accessTokenConfigured=!!tokenSet;
  accessTokenClearPending=false;
  accessTokenMaskActive=accessTokenConfigured;
  syncAccessTokenUi();
}
document.getElementById("config-volume-slider").addEventListener("input",function(){
  setConfigVolume(this.value);
});
document.getElementById("config-volume").addEventListener("input",function(){
  setConfigVolume(this.value);
});
document.getElementById("config-access-token").addEventListener("focus",function(){
  if(accessTokenMaskActive){
    this.value="";
    accessTokenMaskActive=false;
  }
});
document.getElementById("config-access-token").addEventListener("blur",function(){
  if(accessTokenClearPending||!accessTokenConfigured)return;
  if(this.value.trim()===""){
    accessTokenMaskActive=true;
    syncAccessTokenUi();
  }
});
document.getElementById("config-access-token-toggle").addEventListener("click",function(){
  if(accessTokenClearPending){
    accessTokenClearPending=false;
    accessTokenMaskActive=true;
  }else{
    accessTokenClearPending=true;
    accessTokenMaskActive=false;
  }
  syncAccessTokenUi();
});
document.getElementById("config-loading").addEventListener("change",updateWelcomeMotionHint);
document.getElementById("config-welcome").addEventListener("change",updateWelcomeMotionHint);
function loadSettings(){
  apiFetch("/settings").then(function(r){return r.json();}).then(function(j){
    if(!j.ok)return;
    wifiConfigured=!!j.wifi_configured;
    syncWifiStatusFromSettings(j);
    document.getElementById("config-hostname").value=j.hostname||"";
    document.getElementById("config-wifi-hostname").value=j.hostname||"";
    document.getElementById("config-sleep").value=j.sleep_timeout;
    document.getElementById("config-continuous").value=j.continuous_timeout!=null?j.continuous_timeout:5;
    setConfigVolume(j.volume!=null?j.volume:70);
    document.getElementById("config-welcome").checked=j.welcome!==false;
    document.getElementById("config-serial-log").checked=!!j.serial_log;
    document.getElementById("config-loading").value=j.loading==="sleep_inertia"?"sleep_inertia":"progress";
    document.getElementById("config-eyes-style").value=(j.eyes_style==="kaomoji"||j.eyes_style==="cover"||j.eyes_style==="dots")?j.eyes_style:"classic";
    setAccessTokenFromServer(!!j.access_token_set);
    updateWelcomeMotionHint();
    applyServoRangesFromSettings(j);
    applyRgbOrderFromSettings(j);
    applyOledRotateFromSettings(j);
    setupCalibRanges=cloneRanges(SERVO_RANGES);
    updateServoHint();
    if(provisioningMode||!wifiConfigured)applySetupWizardUi();
  }).catch(function(){setStatus("Could not load settings","err");});
}
document.getElementById("setup-move-90").addEventListener("click",function(){
  if(busy)return;
  setupPostServo("all=90").then(function(res){
    if(res.ok&&res.data.ok!==false){
      setupCalibDegs=[90,90,90,90,90];
      setupCalibDeg=90;
    }
  });
});
document.getElementById("setup-horns-done").addEventListener("click",function(){
  setupServoPhase="ranges";
  setupCalibJoint=0;
  setSetupCalibAngle(90);
  applySetupWizardUi();
});
document.getElementById("setup-back").addEventListener("click",function(){
  var id=setupStepId();
  if(id==="network"){
    setSetupStep("speaker");
    applySetupWizardUi();
    return;
  }
  if(id==="speaker"){
    setSetupStep("led");
    applySetupWizardUi();
    return;
  }
  if(id==="led"){
    releaseSetupLed();
    setSetupStep("oled");
    enterSetupOledStep();
    applySetupWizardUi();
    return;
  }
  if(id==="oled"){
    leaveSetupOledStep();
    setSetupStep("servos");
    setupServoPhase="ranges";
    applySetupWizardUi();
    return;
  }
  if(id==="servos"&&setupServoPhase==="ranges"){
    setupServoPhase="horns";
    applySetupWizardUi();
  }
});
document.getElementById("setup-next").addEventListener("click",function(){
  if(busy)return;
  var id=setupStepId();
  if(id==="speaker"){
    setSetupStep("network");
    applySetupWizardUi();
    return;
  }
  if(id==="led"){
    if(!ledMappingValid())return;
    var order=rgbOrderFromLooks();
    setBusy(true);
    setStatus("Saving LED mapping\u2026","loading");
    apiFetch("/settings?rgb_order="+encodeURIComponent(order),{method:"POST"})
      .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
      .then(function(res){
        if(res.ok&&res.data.ok!==false){
          applyRgbOrderFromSettings(res.data);
          releaseSetupLed();
          setSetupStep("speaker");
          applySetupWizardUi();
          clearStatus();
        }else{
          setStatus(res.data.error||"Save failed","err");
        }
      })
      .catch(function(){setStatus("Network error","err");})
      .finally(function(){setBusy(false);applySetupWizardUi();});
    return;
  }
  if(id==="oled"){
    setBusy(true);
    setStatus("Saving screen rotation\u2026","loading");
    apiFetch("/settings?oled_rotate_180="+(setupOledRotate180?1:0),{method:"POST"})
      .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
      .then(function(res){
        if(res.ok&&res.data.ok!==false){
          applyOledRotateFromSettings(res.data);
          setSetupStep("led");
          applySetupWizardUi();
          clearStatus();
        }else{
          setStatus(res.data.error||"Save failed","err");
        }
      })
      .catch(function(){setStatus("Network error","err");})
      .finally(function(){setBusy(false);applySetupWizardUi();});
    return;
  }
  if(id!=="servos"||!calibRangesValid())return;
  var mins=setupCalibRanges.map(function(r){return r[0];}).join(",");
  var maxs=setupCalibRanges.map(function(r){return r[1];}).join(",");
  setBusy(true);
  setStatus("Saving servo ranges\u2026","loading");
  apiFetch("/settings?servo_mins="+encodeURIComponent(mins)+"&servo_maxs="+encodeURIComponent(maxs),{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
    .then(function(res){
      if(res.ok&&res.data.ok!==false){
        applyServoRangesFromSettings(res.data);
        setupCalibRanges=cloneRanges(SERVO_RANGES);
        updateServoHint();
        setSetupStep("oled");
        enterSetupOledStep();
        applySetupWizardUi();
        clearStatus();
      }else{
        setStatus(res.data.error||"Save failed","err");
      }
    })
    .catch(function(){setStatus("Network error","err");})
    .finally(function(){setBusy(false);applySetupWizardUi();});
});
document.getElementById("setup-oled-rotate").addEventListener("click",function(){
  if(busy)return;
  setupOledRotate180=!setupOledRotate180;
  enterSetupOledStep();
});
document.querySelectorAll("[data-led-color]").forEach(function(btn){
  btn.addEventListener("click",function(){
    if(busy)return;
    setupLedTestColor(this.getAttribute("data-led-color"));
  });
});
document.getElementById("setup-led-remap-toggle").addEventListener("click",function(){
  setupLedRemapOpen=true;
  document.getElementById("setup-led-remap").hidden=false;
  updateLedLooksUi();
});
document.getElementById("setup-audio-play").addEventListener("click",function(){
  if(busy)return;
  setBusy(true);
  setStatus("Playing\u2026","loading");
  apiFetch("/setup/audio",{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
    .then(function(res){
      if(res.ok&&res.data.ok!==false){
        setStatus("Done.","ok");
      }else{
        setStatus(res.data.error||"Playback failed","err");
      }
    })
    .catch(function(){setStatus("Network error","err");})
    .finally(function(){setBusy(false);applySetupWizardUi();});
});
document.querySelectorAll(".led-light[data-led-byte]").forEach(function(btn){
  btn.addEventListener("click",function(){
    if(busy)return;
    var byte=this.getAttribute("data-led-byte");
    setupLedPreview("byte="+encodeURIComponent(byte));
  });
});
document.querySelectorAll(".led-looks [data-look]").forEach(function(btn){
  btn.addEventListener("click",function(){
    var row=this.closest(".led-looks");
    if(!row)return;
    var byte=parseInt(row.getAttribute("data-led-byte"),10);
    setupLedLooks[byte]=this.getAttribute("data-look");
    updateLedLooksUi();
    if(setupStepId()==="led"){
      document.getElementById("setup-next").disabled=!ledMappingValid();
    }
  });
});
document.querySelectorAll("#setup-joint-tabs [data-joint]").forEach(function(btn){
  btn.addEventListener("click",function(){
    if(busy)return;
    selectCalibJoint(parseInt(this.getAttribute("data-joint"),10));
  });
});
document.querySelectorAll(".calib-nudge [data-nudge]").forEach(function(btn){
  btn.addEventListener("click",function(){
    nudgeCalib(parseInt(this.getAttribute("data-nudge"),10));
  });
});
document.getElementById("setup-calib-slider").addEventListener("input",function(){
  document.getElementById("setup-calib-angle").textContent=this.value;
});
document.getElementById("setup-calib-slider").addEventListener("change",function(){
  moveCalib(parseInt(this.value,10));
});
document.getElementById("setup-set-min").addEventListener("click",function(){
  var a=setupCalibAngle();
  if(isNaN(a)||a>=setupCalibRanges[setupCalibJoint][1]){
    setStatus("Min must be less than max.","err");
    return;
  }
  setupCalibRanges[setupCalibJoint][0]=a;
  updateCalibUi();
});
document.getElementById("setup-set-max").addEventListener("click",function(){
  var a=setupCalibAngle();
  if(isNaN(a)||a<=setupCalibRanges[setupCalibJoint][0]){
    setStatus("Max must be greater than min.","err");
    return;
  }
  setupCalibRanges[setupCalibJoint][1]=a;
  updateCalibUi();
});
document.getElementById("setup-reset-joint").addEventListener("click",function(){
  setupCalibRanges[setupCalibJoint]=[SERVO_DEFAULT_RANGES[setupCalibJoint][0],SERVO_DEFAULT_RANGES[setupCalibJoint][1]];
  updateCalibUi();
});
document.getElementById("config-wifi-password-toggle").addEventListener("click",function(){
  var field=document.getElementById("config-wifi-password");
  var show=field.type==="password";
  field.type=show?"text":"password";
  this.textContent=show?"Hide":"Show";
});
document.getElementById("config-wifi-connect").addEventListener("click",function(){
  if(busy)return;
  var ssid=document.getElementById("config-wifi-ssid").value.trim();
  var password=document.getElementById("config-wifi-password").value;
  var hostField=document.getElementById("config-wifi-hostname");
  hostField.value=hostField.value.trim();
  if(!ssid){
    setStatus("Enter a WiFi network name.","err");
    return;
  }
  if(!hostField.reportValidity())return;
  var host=hostField.value;
  setBusy(true);
  setStatus("Testing WiFi credentials\u2026","loading");
  var url="/settings?wifi_ssid="+encodeURIComponent(ssid)+"&wifi_password="+encodeURIComponent(password)+"&hostname="+encodeURIComponent(host);
  apiFetch(url,{method:"POST"})
  .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
  .then(function(res){
    if(res.ok&&res.data.ok!==false&&res.data.wifi_connect_success){
      document.getElementById("config-wifi-password").value="";
      wifiConfigured=true;
      provisioningMode=false;
      document.body.classList.remove("setup-mode");
      syncSetupUi();
      syncWifiStatusFromSettings(res.data);
      var next="WiFi connected. Rejoin your home network";
      if(res.data.wifi_ip)next+=" and open http://"+res.data.wifi_ip;
      if(res.data.wifi_hostname)next+=" or http://"+res.data.wifi_hostname;
      next+=".";
      setStatus(next,"ok");
    }else{
      setStatus(res.data.error||"WiFi connection failed","err");
    }
  }).catch(function(){setStatus("Network error","err");})
  .finally(function(){setBusy(false);});
});
document.getElementById("config-form").addEventListener("submit",function(e){
  e.preventDefault();
  if(busy)return;
  var prevHost=document.getElementById("config-hostname").value.trim();
  var prevLoading=document.getElementById("config-loading").value;
  var host=document.getElementById("config-hostname").value.trim();
  var sleep=document.getElementById("config-sleep").value;
  var continuous=document.getElementById("config-continuous").value;
  var volume=document.getElementById("config-volume").value;
  var welcome=document.getElementById("config-welcome").checked?1:0;
  var serialLog=document.getElementById("config-serial-log").checked?1:0;
  var loading=document.getElementById("config-loading").value;
  var eyesStyle=document.getElementById("config-eyes-style").value;
  var newToken=document.getElementById("config-access-token").value;
  var wasClearPending=accessTokenClearPending;
  var url="/settings?sleep_timeout="+encodeURIComponent(sleep)+"&hostname="+encodeURIComponent(host)+"&volume="+encodeURIComponent(volume)+"&welcome="+welcome+"&serial_log="+serialLog+"&continuous_timeout="+encodeURIComponent(continuous)+"&loading="+encodeURIComponent(loading)+"&eyes_style="+encodeURIComponent(eyesStyle);
  if(wasClearPending)url+="&access_token=";
  else if(!accessTokenMaskActive&&newToken)url+="&access_token="+encodeURIComponent(newToken);
  setBusy(true);
  setStatus("Saving\u2026","loading");
  apiFetch(url,{method:"POST"})
  .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
  .then(function(res){
    if(res.ok&&res.data.ok!==false){
      document.getElementById("config-hostname").value=res.data.hostname||host;
      document.getElementById("config-sleep").value=res.data.sleep_timeout;
      document.getElementById("config-continuous").value=res.data.continuous_timeout!=null?res.data.continuous_timeout:continuous;
      setConfigVolume(res.data.volume!=null?res.data.volume:volume);
      document.getElementById("config-welcome").checked=res.data.welcome!==false;
      document.getElementById("config-serial-log").checked=!!res.data.serial_log;
      document.getElementById("config-loading").value=res.data.loading==="sleep_inertia"?"sleep_inertia":"progress";
      document.getElementById("config-eyes-style").value=(res.data.eyes_style==="kaomoji"||res.data.eyes_style==="cover"||res.data.eyes_style==="dots")?res.data.eyes_style:"classic";
      if(wasClearPending)setStoredToken("");
      else if(!accessTokenMaskActive&&newToken)setStoredToken(newToken);
      setAccessTokenFromServer(!!res.data.access_token_set);
      updateWelcomeMotionHint();
      setStatus(buildSaveMessage(prevHost,prevLoading,res),"ok");
    }else{
      setStatus(res.data.error||"Save failed","err");
    }
  }).catch(function(){setStatus("Network error","err");})
  .finally(function(){setBusy(false);});
});
document.getElementById("config-factory-reset").addEventListener("click",function(){
  if(busy)return;
  if(!confirm("Reset settings to factory defaults? WiFi credentials will be cleared. Servo ranges, RGB LED mapping, and screen rotation stay. Power-cycle the device to reopen setup AP mode and configure WiFi again."))return;
  setBusy(true);
  setStatus("Resetting\u2026","loading");
  apiFetch("/settings/reset",{method:"POST"})
  .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
  .then(function(res){
    if(res.ok&&res.data.ok!==false){
      setStoredToken("");
      setAccessTokenFromServer(false);
      clearStatus();
      showRebootGate(true);
    }else{
      setStatus(res.data.error||"Factory reset failed","err");
    }
  }).catch(function(){setStatus("Network error","err");})
  .finally(function(){setBusy(false);});
});
document.querySelectorAll("[data-anim]").forEach(function(btn){
  btn.addEventListener("click",function(){
    if(busy)return;
    var name=this.getAttribute("data-anim");
    setBusy(true);
    setStatus("Setting animation\u2026","loading");
    apiFetch("/anim?name="+name,{method:"POST"})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,data:j};});})
    .then(function(res){
      if(res.ok&&res.data.ok!==false){
        setStatus("Animation: "+res.data.animation,"ok");
        document.querySelector("#anim-current strong").textContent=res.data.animation;
      }else{
        setStatus(res.data.error||"Failed","err");
      }
    }).catch(function(){setStatus("Network error","err");})
    .finally(function(){setBusy(false);});
  });
});
document.querySelectorAll("[data-test]").forEach(function(btn){
  btn.addEventListener("click",function(){
    apiPost(this.getAttribute("data-test"));
  });
});
document.getElementById("auth-form").addEventListener("submit",function(e){
  e.preventDefault();
  var token=document.getElementById("auth-token").value;
  if(!token)return;
  setStoredToken(token);
  document.getElementById("auth-error").classList.remove("show");
  apiFetch("/settings").then(function(r){
    if(r.status===401){
      setStoredToken("");
      document.getElementById("auth-error").classList.add("show");
      return;
    }
    enterApp();
  }).catch(function(){
    setStoredToken("");
    document.getElementById("auth-error").classList.add("show");
  });
});
function bootUi(){
  document.body.classList.add("locked");
  fetch("/auth").then(function(r){return r.json();}).then(function(j){
    if(!j.ok||!j.required){
      enterApp();
      return;
    }
    var token=getStoredToken();
    if(!token){
      showAuthGate(true);
      return;
    }
    apiFetch("/settings").then(function(r){
      if(r.status===401){
        setStoredToken("");
        showAuthGate(true);
        return;
      }
      enterApp();
    }).catch(function(){
      showAuthGate(true);
    });
  }).catch(function(){
    enterApp();
  });
}
document.addEventListener("DOMContentLoaded",bootUi);
