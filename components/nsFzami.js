const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");


function FzamiService() {
	this.wrappedJSObject = this;
}

FzamiService.prototype = {
	classDescription: "fzami service",
	contractID: "@mozdev.org/fzami/component;1",
	classID: Components.ID("{9939B49E-64A3-11DB-8373-B622A1EF5492}"),
	_xpcom_categories: [{ category: "profile-after-change", service: true }],

	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),


  ptService: null,
  timer: null,
  initialized: false,
  preferences: null,
  bundle: Components.classes["@mozilla.org/intl/stringbundle;1"]
		        	.getService(Components.interfaces.nsIStringBundleService)  
					.createBundle("chrome://fzami/locale/fzami.properties"),

 
  startup: function() {
  	if (this.initialized) return;
  	this.initialized = true;
  	
    var obsSvc = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    obsSvc.addObserver(this, "profile-after-change", false);
    obsSvc.addObserver(this, "xpcom-shutdown", false);
    obsSvc.addObserver(this, "fzami:prayertimes-loaded", false);
//    obsSvc.addObserver(this, "fzami:preferences-changed", false);
    obsSvc.addObserver(this, "quit-application", false);
  	
  	this.preferences = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
  	this.ptService = Components.classes["@mozdev.org/fzami/ptservice;1"].getService().wrappedJSObject;
	this.timer = Components.classes["@mozilla.org/timer;1"]
            .createInstance(Components.interfaces.nsITimer);
  	this.reloadPrayerTimes();
  	this.recalculateCurrentPrayer();
    this.timer.init(this, 60000, 1);
  },
  
  shutdown: function() {
    var obsSvc = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    obsSvc.removeObserver(this, "profile-after-change");
    obsSvc.removeObserver(this, "xpcom-shutdown");
    obsSvc.removeObserver(this, "fzami:prayertimes-loaded");
//    obsSvc.removeObserver(this, "fzami:preferences-changed");
    obsSvc.removeObserver(this, "quit-application");
	if (this.timer != null) {
		this.timer.cancel();
	}
	this.ptService = null;
	this.timer = null;
  },

  getPrayerInfo: function() {
  	if (this.prayertimes != null) {
  		return {
	  		"prayerTimes": this.prayertimes,
	  		"date": this.dateOfPrayerTimes,
	  		"currentPrayer": this.currentPrayer,
	  		"nextPrayerTime": this.getNextPrayerTime(),
	  		"isInAlert": this.isInEndingAlertTimeSpan()
  		};
  	} else {
	  	return null;
  	}
  },

  reloadPrayerTimes: function(force) {
  	this.ptService.reloadPrayerTimes( force );
  },

  recalculateCurrentPrayer: function()
  {
	var oldPrayerName = this.currentPrayer;
	this.currentPrayer = null;
	if (this.prayertimes == null) {
		return;
	}

	var currentTime = new Date();
	if (this.prayertimes['fajr'].before(currentTime) && this.prayertimes['shuruk'].after(currentTime)) this.currentPrayer = 'fajr';
	if (this.prayertimes['shuruk'].before(currentTime) && this.prayertimes['zuhr'].after(currentTime)) this.currentPrayer = 'shuruk';
	if (this.prayertimes['zuhr'].before(currentTime) && this.prayertimes['asr'].after(currentTime)) this.currentPrayer = 'zuhr';
	if (this.prayertimes['asr'].before(currentTime) && this.prayertimes['maghrib'].after(currentTime)) this.currentPrayer = 'asr';
	if (this.prayertimes['maghrib'].before(currentTime) && this.prayertimes['isha'].after(currentTime)) this.currentPrayer = 'maghrib';
	if (this.prayertimes['isha'].before(currentTime) || this.prayertimes['fajr'].after(currentTime)) this.currentPrayer = 'isha';

    if (oldPrayerName != null && this.currentPrayer != oldPrayerName)
	{
		this.endPrayerAlertShown = false;
		if (this.currentPrayer != 'shuruk') {
			this.showStartPrayerTimeAlert();
		}

	  	if (this.preferences && 
		  		this.preferences.getBoolPref("extensions.fzami.debug")) {
	  		Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService)
				.logStringMessage("nsFzami: Sending fzami:currentPrayer-changed with "+this.currentPrayer);
	  	}
		Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService)
            .notifyObservers(this, "fzami:currentPrayer-changed", this.currentPrayer);
	} else if (this.currentPrayer != null && !this.endPrayerAlertShown) {
		if (this.isInEndingAlertTimeSpan())
		{
			this.showEndPrayerTimeAlert();
			this.endPrayerAlertShown = true;

			if (this.currentPrayer != 'shuruk') {
		  	if (this.preferences && 
			  		this.preferences.getBoolPref("extensions.fzami.debug")) {
		  		Components.classes["@mozilla.org/consoleservice;1"]
					.getService(Components.interfaces.nsIConsoleService)
					.logStringMessage("nsFzami: Sending fzami:currentPrayer-alert with "+this.currentPrayer);
		  	}
			Components.classes["@mozilla.org/observer-service;1"]
	            .getService(Components.interfaces.nsIObserverService)
	            .notifyObservers(this, "fzami:currentPrayer-alert", this.currentPrayer);
			}
		}
	}
  },

  isInEndingAlertTimeSpan: function()
  {
	var now = new Date();
	var nextPrayerTime = this.getNextPrayerTime();
	if (this.currentPrayer != null 
		&& this.currentPrayer != 'shuruk' 
		&& nextPrayerTime != null 
		&& nextPrayerTime.after(now))
	{
		var endBuffer = this.preferences.getIntPref("extensions.fzami.alert.end.buffer");
		now.setMinutes(now.getMinutes()+endBuffer);
		if (nextPrayerTime.before(now))
		{
			return true;
		}
	}
	return false;
  },

  getNextPrayerName: function()
  {
	switch (this.currentPrayer)
	{
		case 'fajr' : return 'shuruk'; break;
		case 'shuruk' : return 'zuhr'; break;
		case 'zuhr' : return 'asr'; break;
		case 'asr' : return 'maghrib'; break;
		case 'maghrib' : return 'isha'; break;
		case 'isha' : return 'fajr'; break;
		default : return null;
	}
	return null;
  },

  getNextPrayerTime: function()
  {
	var prayer = this.getNextPrayerName();
	if (prayer == null || this.prayertimes == null) return null;
	return this.prayertimes[prayer];
  },

  showStartPrayerTimeAlert : function()
  {
	var showStartAlert = this.preferences.getBoolPref("extensions.fzami.alert.start");
	if (showStartAlert)
	{
		if (this.preferences.getBoolPref("extensions.fzami.alert.start.audio")) {
			var filename = null;
			try {
				filename = this.preferences.getCharPref("extensions.fzami.alert.start.audio.filename");
			} catch(e) {}
			var gSound = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound);
			gSound.init();

			if ( filename == null || filename == "" ) {
				gSound.beep();	
			} else {
				var file = Components.classes["@mozilla.org/file/local;1"]
						.createInstance(Components.interfaces.nsIFile);
				file.initWithPath( filename );						
				var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
				var fileURI = ios.newFileURI(file);				
				gSound.play(fileURI);	
			}
		}
		if (this.preferences.getBoolPref("extensions.fzami.alert.start.confirm")) {
			Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService)
				.alert(null, this.bundle.GetStringFromName("fzami.alert.title"), this.bundle.formatStringFromName("fzami.alert.start-prayer", [this.currentPrayer], 1) );
		} else {
			Components.classes["@mozilla.org/alerts-service;1"]
				.getService(Components.interfaces.nsIAlertsService)
				.showAlertNotification(null, this.bundle.GetStringFromName("fzami.alert.title"), this.bundle.formatStringFromName("fzami.alert.start-prayer", [this.currentPrayer], 1), false, null, this);
		}
		
	}
  },

  showEndPrayerTimeAlert : function()
  {
	if (this.currentPrayer != null)
	{
		var showEndAlert = this.preferences.getBoolPref("extensions.fzami.alert.end");
		var endBuffer = this.preferences.getIntPref("extensions.fzami.alert.end.buffer");
		if (showEndAlert)
		{
			var msg = this.bundle.formatStringFromName("fzami.alert.end-prayer", [endBuffer, this.currentPrayer], 2);
			if (this.currentPrayer == "shuruk") {
				msg = this.bundle.formatStringFromName("fzami.alert.end-shuruk", [endBuffer], 1);
			}

			if (this.preferences.getBoolPref("extensions.fzami.alert.end.confirm")) {
				Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService)
					.alert(null, this.bundle.GetStringFromName("fzami.alert.title"), msg);
			} else {
				Components.classes["@mozilla.org/alerts-service;1"]
					.getService(Components.interfaces.nsIAlertsService)
					.showAlertNotification(null, this.bundle.GetStringFromName("fzami.alert.title"), msg, false, null, this);
			}
		}
	}
	
  },
  
  setPrayerTimes: function(prayerTimes) {
  	if (prayerTimes != null) {
  		var times = JSON.parse(prayerTimes);
	  	this.prayertimes = new Array;
	  	this.prayertimes['fajr'] = this.newTime(times.fajr);
	  	this.prayertimes['shuruk'] = this.newTime(times.shuruk);
	  	this.prayertimes['zuhr'] = this.newTime(times.zuhr);
	  	this.prayertimes['asr'] = this.newTime(times.asr);
	  	this.prayertimes['maghrib'] = this.newTime(times.maghrib);
	  	this.prayertimes['isha'] = this.newTime(times.isha);
  		this.dateOfPrayerTimes = new Date();
  		this.recalculateCurrentPrayer();

	  	if (this.preferences && 
		  		this.preferences.getBoolPref("extensions.fzami.debug")) {
	  		Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService)
				.logStringMessage("nsFzami: Sending fzami:prayertimes-changed with null");
	  	}
        Components.classes["@mozilla.org/observer-service;1"]
    	   .getService(Components.interfaces.nsIObserverService)
    	   .notifyObservers(this, "fzami:prayertimes-changed", null);
  	}
  },

	newTime: function(string) {
		return Components.classes["@mozdev.org/fzami/time;1"].createInstance().wrappedJSObject.initialize(string);
	},
	









  // nsIObserver implementation
  observe: function(aSubject, aTopic, aData) {
  	if (this.preferences && 
	  		this.preferences.getBoolPref("extensions.fzami.debug")) {
  		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("nsFzami: Received "+aTopic+" with "+aData);
  	}
    switch(aTopic) {
      case "profile-after-change":
      	this.initialized = false;
        break;

      case "xpcom-shutdown":
      case "quit-application":
      	this.shutdown();
        break;

	  case "fzami:prayertimes-loaded":
	  	this.setPrayerTimes(aData);
	  	break;
//	  case "fzami:preferences-changed":
	  case "timer-callback":
	  	this.reloadPrayerTimes();
	  	this.recalculateCurrentPrayer();
	  	break;
	  default: new new Error("unknown topic:"+aTopic); break;
    }
  }
};

/*
var myModule = { 
	_firstTime: true,
     myCID: Components.ID("{9939B49E-64A3-11DB-8373-B622A1EF5492}"),
	 classID: Components.ID("{9939B49E-64A3-11DB-8373-B622A1EF5492}"),
     myProgID: "@mozdev.org/fzami/component;1",
 
     registerSelf: function (compMgr, fileSpec, location, type) {
	    if (this._firstTime) {
	      this._firstTime = false;
	      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
	    };
         compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
         compMgr.registerFactoryLocation(this.myCID,
                                         "Fzami Component",
                                         this.myProgID,
                                         fileSpec,
                                         location,
                                         type);
     },
 
     getClassObject: function (compMgr, cid, iid) {
         if (!cid.equals(this.myCID))
             throw Components.results.NS_ERROR_NO_INTERFACE;
 
         if (!iid.equals(Components.interfaces.nsIFactory))
             throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
 
        return this.myFactory;
     },

     myFactory: {
         createInstance: function (outer, iid) {
            if (outer != null)
                 throw Components.results.NS_ERROR_NO_AGGREGATION;
             return (new FzamiService()).QueryInterface(iid);
         }
     },
 
     canUnload: function(compMgr) {
         return true;
     }
 };
 
 function NSGetModule(compMgr, fileSpec) {
     return myModule;
 } 
 
*/
if (XPCOMUtils.generateNSGetFactory)
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([FzamiService]);
else
	var NSGetModule = XPCOMUtils.generateNSGetModule([FzamiService]);
