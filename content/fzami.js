var fzami = null;

var fzamiLoad = function() {
  fzami = new FZami();
  fzami.start();
};

var fzamiUnload = function() {
  if (fzami != null)
  {
    fzami.stop();
  }
  fzami = null;
}

var fzamiRefresh = function(force) {
  if (fzami != null)
  {
    fzami.refresh();
  } else {
    fzamiLoad();
  }
}


function openLink(url)
{
  var browser = window.document.getElementById("content");
  browser.loadURI(url);
  window.content.focus();
}


function openMonthlyPrayerSchedule() {
      try {
        var url = Components.classes["@mozdev.org/fzami/ptservice;1"].getService().wrappedJSObject.calculatePrayerTimeUrl();
        openLink(url);
      } catch(e) {
        openLink("http://www.islamicfinder.org/");
      }
}


function FZami() {};

FZami.prototype = {
  preferences: Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch),
  manager: Components.classes["@mozdev.org/fzami/component;1"].getService().wrappedJSObject,
  bundle: Components.classes["@mozilla.org/intl/stringbundle;1"]
		        	.getService(Components.interfaces.nsIStringBundleService)  
					.createBundle("chrome://fzami/locale/fzami.properties"),

  start : function() {
  	var obsService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
	obsService.addObserver(this, "fzami:preferences-changed", false);
	obsService.addObserver(this, "fzami:prayertimes-loading", false);
	obsService.addObserver(this, "fzami:prayertimes-changed", false);
	obsService.addObserver(this, "fzami:prayertimes-error", false);
	obsService.addObserver(this, "fzami:currentPrayer-changed", false);
	obsService.addObserver(this, "fzami:currentPrayer-alert", false);

	this.rerender();
  	this.manager.startup();
  },

  stop : function() {
  	var obsService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
	obsService.removeObserver(this, "fzami:preferences-changed");
	obsService.removeObserver(this, "fzami:prayertimes-loading");
	obsService.removeObserver(this, "fzami:prayertimes-changed");
	obsService.removeObserver(this, "fzami:prayertimes-error");
	obsService.removeObserver(this, "fzami:currentPrayer-changed");
	obsService.removeObserver(this, "fzami:currentPrayer-alert");
  },

  refresh: function() {
  	this.manager.reloadPrayerTimes(true);
  },

  observe : function(subject, topic, data) {
  	if (this.preferences && 
	  		this.preferences.getBoolPref("extensions.fzami.debug")) {
		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("fzami: Received "+topic+" with "+data);
  	}

	switch (topic) {
		case "fzami:prayertimes-loading": 
			this.showProgress();
			break;
		case "fzami:prayertimes-error":
			this.showError(data);
			break;
		case "fzami:prayertimes-changed":
		case "fzami:preferences-changed":
		case "fzami:currentPrayer-alert": 
		case "fzami:currentPrayer-changed": 
			this.rerender();
			break;
	}
  },

  showProgress : function() {
	var deck = document.getElementById("fzami-deck");
	for (var i = 0; i < deck.childNodes.length; i++) deck.childNodes[i].setAttribute("collapsed", "true");
	document.getElementById("fzami-progressmeter").setAttribute("collapsed", "false");
  },

  showError : function(errMsg) {
	var statusElement = document.getElementById("fzami-panel");
	statusElement.setAttribute("status", "enabled");
	var errorDescElement = document.getElementById("fzami-errormsg");
	errorDescElement.setAttribute("value", errMsg);
	var deck = document.getElementById("fzami-deck");

	for (var i = 0; i < deck.childNodes.length; i++) deck.childNodes[i].setAttribute("collapsed", "true");
	document.getElementById("fzami-error-box").setAttribute("collapsed", "false");

    this.clearToolTip();
  },

  clearToolTip : function() {
	var tooltip = document.getElementById("fzami-tooltip");
    while (tooltip.childNodes.length > 0) tooltip.removeChild(tooltip.childNodes[0]);
    tooltip.removeAttribute("title");
    tooltip.removeAttribute("label");

    var vbox = document.createElement("vbox");
	tooltip.appendChild(vbox);

	var description = document.createElement("description");
	description.setAttribute("class", "fzami-tooltip-title");
	description.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.error.title"));
	vbox.appendChild(description);

	description = document.createElement("description");
	vbox.appendChild(description);
	description.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.error.message1"));

	description = document.createElement("description");
	vbox.appendChild(description);
	description.setAttribute("value",  this.bundle.GetStringFromName("fzami.tooltip.error.message2"));

	description = document.createElement("description");
	vbox.appendChild(description);
	description.setAttribute("value",  this.bundle.GetStringFromName("fzami.tooltip.error.message3"));

	description = document.createElement("description");
	vbox.appendChild(description);
	description.setAttribute("value",  this.bundle.GetStringFromName("fzami.tooltip.error.message4"));

	description = document.createElement("description");
	vbox.appendChild(description);
	description.setAttribute("value",  this.bundle.GetStringFromName("fzami.tooltip.error.message5"));
  },

  showPrayerTimes : function() {
	var statusElement = document.getElementById("fzami-panel");
	statusElement.setAttribute("status", "enabled");
	var deck = document.getElementById("fzami-deck");
	for (var i = 0; i < deck.childNodes.length; i++) deck.childNodes[i].setAttribute("collapsed", "true");
	var displayType = this.preferences.getIntPref("extensions.fzami.displayType");

	var boxName = null;
	switch(displayType)
	{
		case 0 : boxName = "fzami-one-prayer-box"; break;
		case 1 : boxName = "fzami-all-prayers-box"; break;
		default : boxName = "fzami-text-box"; break;
	}
	document.getElementById(boxName).setAttribute("collapsed", "false");
  },

  rerender: function() {
  	var prayerInfo = this.manager.wrappedJSObject.getPrayerInfo();
  	if (prayerInfo != null) {
  		var prayerTimes = prayerInfo.prayerTimes;
  		var dateOfPrayerTimes = prayerInfo.date;
	  	var currentPrayer = prayerInfo.currentPrayer;
	  	var nextPrayerTime = prayerInfo.nextPrayerTime;
	  	var inAlertTimeSpan = prayerInfo.isInAlert;

		this.redisplayPrayerTimes(prayerTimes, dateOfPrayerTimes, currentPrayer, nextPrayerTime);
		this.setToolTip(prayerTimes, dateOfPrayerTimes);
		this.highlightCurrentPrayer(currentPrayer, inAlertTimeSpan);
		this.showPrayerTimes();
  	}
  },

  setToolTip : function(prayerTimes, dateOfPrayerTimes) {
	var tooltip = document.getElementById("fzami-tooltip");
    while (tooltip.childNodes.length > 0) tooltip.removeChild(tooltip.childNodes[0]);
    tooltip.removeAttribute("title");
    tooltip.removeAttribute("label");

  	var location = null;
	if (this.preferences.getIntPref("extensions.fzami.location.type") == 0)
	{
		location = this.preferences.getCharPref("extensions.fzami.location.zipcode");
	} else {
		location = this.preferences.getCharPref("extensions.fzami.location.city");
	}
    var date = (dateOfPrayerTimes.getYear()+1900)+"-"+(dateOfPrayerTimes.getMonth()+1)+"-"+dateOfPrayerTimes.getDate();
	var militaryTime = this.preferences.getBoolPref("extensions.fzami.militaryTime");

    var vbox = document.createElement("vbox");
	tooltip.appendChild(vbox);

	var description = document.createElement("description");
	description.setAttribute("class", "fzami-tooltip-title");
	description.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.title"));
	vbox.appendChild(description);

	var separator = document.createElement("separator");
	separator.setAttribute("class", "groove-thin");
	vbox.appendChild(separator);

	description = document.createElement("description");
	description.setAttribute("value", this.bundle.formatStringFromName("fzami.tooltip.prayertimes.location", [location], 1));
	vbox.appendChild(description);

	description = document.createElement("description");
	description.setAttribute("value", this.bundle.formatStringFromName("fzami.tooltip.prayertimes.date", [date], 1));
	vbox.appendChild(description);

	separator = document.createElement("separator");
	separator.setAttribute("class", "groove-thin");
	vbox.appendChild(separator);

	var grid = document.createElement("grid");
	vbox.appendChild(grid);
	var rows = document.createElement("rows");
	grid.appendChild(rows);

	var row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-fajr-time-row");
	rows.appendChild(row);
	var prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.fajr"));
	row.appendChild(prayerName);
	var prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["fajr"].formatTime(militaryTime));
	row.appendChild(prayerTime);

	row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-shuruk-time-row");
	rows.appendChild(row);
	prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.shuruk"));
	row.appendChild(prayerName);
	prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["shuruk"].formatTime(militaryTime));
	row.appendChild(prayerTime);

	row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-zuhr-time-row");
	rows.appendChild(row);
	prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.zuhr"));
	row.appendChild(prayerName);
	prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["zuhr"].formatTime(militaryTime));
	row.appendChild(prayerTime);

	row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-asr-time-row");
	rows.appendChild(row);
	prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.asr"));
	row.appendChild(prayerName);
	prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["asr"].formatTime(militaryTime));
	row.appendChild(prayerTime);

	row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-maghrib-time-row");
	rows.appendChild(row);
	prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.maghrib"));
	row.appendChild(prayerName);
	prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["maghrib"].formatTime(militaryTime));
	row.appendChild(prayerTime);

	row = document.createElement("row");
	row.setAttribute("id", "fzami-tooltip-isha-time-row");
	rows.appendChild(row);
	prayerName = document.createElement("label");
	prayerName.setAttribute("value", this.bundle.GetStringFromName("fzami.tooltip.prayertimes.isha"));
	row.appendChild(prayerName);
	prayerTime = document.createElement("label");
	prayerTime.setAttribute("value", prayerTimes["isha"].formatTime(militaryTime));
	row.appendChild(prayerTime);
  },

  redisplayPrayerTimes : function(prayerTimes, dateOfPrayerTimes, currentPrayer, nextPrayerTime) {
	if (prayerTimes == null) return;
	var militaryTime = this.preferences.getBoolPref("extensions.fzami.militaryTime");

	document.getElementById("fzami-fajr-time").value = prayerTimes['fajr'].formatTime(militaryTime)+" - "+prayerTimes['shuruk'].formatTime(militaryTime);
	document.getElementById("fzami-zuhr-time").value = prayerTimes['zuhr'].formatTime(militaryTime);
	document.getElementById("fzami-asr-time").value = prayerTimes['asr'].formatTime(militaryTime);
	document.getElementById("fzami-maghrib-time").value = prayerTimes['maghrib'].formatTime(militaryTime);
	document.getElementById("fzami-isha-time").value = prayerTimes['isha'].formatTime(militaryTime);

	if (currentPrayer != null && currentPrayer != 'shuruk')
	{
		document.getElementById("fzami-current-prayer-label").value = currentPrayer+":";
		document.getElementById("fzami-current-prayer-time").value = prayerTimes[currentPrayer].formatTime(militaryTime)+" - "+nextPrayerTime.formatTime(militaryTime);
	} else if (currentPrayer == 'shuruk') {
		document.getElementById("fzami-current-prayer-label").value = "";
		document.getElementById("fzami-current-prayer-time").value = this.bundle.formatStringFromName("fzami.tooltip.prayertimes.zuhr-start", [prayerTimes['zuhr'].formatTime(militaryTime)], 1);
	} else {
		document.getElementById("fzami-current-prayer-label").value = "";
		document.getElementById("fzami-current-prayer-time").value = this.bundle.GetStringFromName("fzami.tooltip.prayertimes.no-prayer-time");
	}
  },

  highlightCurrentPrayer: function(currentPrayer, inAlertTime)
  {
	document.getElementById("fzami-fajr-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-zuhr-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-asr-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-maghrib-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-isha-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-current-prayer-box").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-text-box").setAttribute("class", "fzami-box");

	document.getElementById("fzami-tooltip-fajr-time-row").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-tooltip-shuruk-time-row").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-tooltip-zuhr-time-row").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-tooltip-asr-time-row").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-tooltip-maghrib-time-row").setAttribute("class", "fzami-prayer-time");
	document.getElementById("fzami-tooltip-isha-time-row").setAttribute("class", "fzami-prayer-time");

	var classname = "fzami-current-prayer-time";
	if (inAlertTime)
	{
		classname = "fzami-current-prayer-time-ending";
		document.getElementById("fzami-current-prayer-box").setAttribute("class", "fzami-current-prayer-time-ending");
		document.getElementById("fzami-text-box").setAttribute("class", "fzami-current-prayer-time-ending");
	}

	switch (currentPrayer)
	{
		case 'shuruk': break;
		default:
			document.getElementById("fzami-"+currentPrayer+"-box").setAttribute("class", classname);
			document.getElementById("fzami-tooltip-"+currentPrayer+"-time-row").setAttribute("class", classname);
			break;
	}
  }
};