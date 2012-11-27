const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

String.prototype.trim = function() {
  return this.replace( /^\s+/g, "" ).replace( /\s+$/g, "" );
}

function PrayerTimeService() {
	this.wrappedJSObject = this;
}

PrayerTimeService.prototype = {
	classDescription: "prayer times service",
	contractID: "@mozdev.org/fzami/ptservice;1",
	classID: Components.ID("{9F64D46C-64A5-11DB-8373-B622A1EF5492}"),
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),


  basePrayerTimeURL: "http://www.islamicfinder.org/prayerDetail.php?",
  baseCitiesUrl: "http://www.islamicfinder.org/cityPrayerD.php?",
  lastRequest: null,
  lastRequestDate: null,
  preferences: Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch),
  server: Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest),
  bundle: Components.classes["@mozilla.org/intl/stringbundle;1"]
		        	.getService(Components.interfaces.nsIStringBundleService)  
					.createBundle("chrome://fzami/locale/fzami.properties"),
  
  reloadPrayerTimes: function(force) {
      var URL = null;
      try {
        URL = this.calculatePrayerTimeUrl();
      } catch(e) {
        this.lastRequest = null;
        this.onErrorLoadingPrayerTimes(this.bundle.GetStringFromName("fzami.error.pref-reading"));
   		this.openOptionsDialog();        
		return;
      }
      if (typeof(force) == "undefined") force = false;
      if (!force && this.lastRequest == URL)
      {
        var now = new Date();
        if (this.lastRequestDate != null
		&& this.lastRequestDate.getYear() == now.getYear()
		&& this.lastRequestDate.getMonth() == now.getMonth()
		&& this.lastRequestDate.getDay() == now.getDay())
        {
	  	  if (this.preferences && 
		  		this.preferences.getBoolPref("extensions.fzami.debug")) {
	  		Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService)
				.logStringMessage("nsPrayerTimes: skipped getting prayer times for "+this.lastRequestDate);
	  	  }
          return;
        }
      }

  	  if (this.preferences && 
	  		this.preferences.getBoolPref("extensions.fzami.debug")) {
  		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("nsPrayerTimes: Sending fzami:prayertimes-loading with null");
  	  }
      Components.classes["@mozilla.org/observer-service;1"]
       	.getService(Components.interfaces.nsIObserverService)
       	.notifyObservers(this, "fzami:prayertimes-loading", null);

      this.lastRequest = URL;
      this.lastRequestDate = new Date();

      //setup request and send
      var module = this;
      this.server.abort();
      this.server.open("GET", URL, true);
      
      this.server.QueryInterface(Components.interfaces.nsIJSXMLHttpRequest).onerror = function() {
      	 module.onErrorLoadingPrayerTimes();
      }
      this.server.QueryInterface(Components.interfaces.nsIJSXMLHttpRequest).onload = function() {
      	module.onLoadPrayerTimes(this.responseText, this.status);
      }
      
      try {
        if (this.server.channel instanceof Components.interfaces.nsISupportsPriority)
          this.server.channel.priority = Components.interfaces.nsISupportsPriority.PRIORITY_HIGHEST;
      } catch(e) {};
      this.server.send(null);
  },

  calculatePrayerTimeUrl: function() {
	var url = this.basePrayerTimeURL;
	var today = new Date();
	url += "&month="+(today.getMonth()+1)+"&year="+today.getFullYear()+"&day="+today.getDate();

	var uscLocation = this.preferences.getIntPref("extensions.fzami.location.type");
	if (uscLocation == 0)
	{
		var zipcode = this.preferences.getCharPref("extensions.fzami.location.zipcode");
		var country = this.isUSZipCode(zipcode) ? "usa" : "canada";
		url += "&country="+country+"&zipcode="+zipcode;	
	} else {
		var city = this.preferences.getCharPref("extensions.fzami.location.city");
		var country = this.preferences.getCharPref("extensions.fzami.location.country");
		url += "&country="+country+"&city="+city;
		try {
			var state = this.preferences.getCharPref("extensions.fzami.location.state");
			if (state != null) {
				url += "&state="+state;
			}
		} catch (e) {
		}
	}

	var prayerCalcMethod = this.preferences.getIntPref("extensions.fzami.prayercal.method");
	var asrmethod = this.preferences.getIntPref("extensions.fzami.prayercal.asrmethod");
	url += "&HanfiShafi="+asrmethod;
	url += "&pmethod="+prayerCalcMethod;
 	if (prayerCalcMethod == 6)
	{
		var fajrTwilight = this.preferences.getIntPref("extensions.fzami.prayercal.fajrangle");
		var dhuhrInterval = this.preferences.getIntPref("extensions.fzami.prayercal.zuhrdelay");
		var maghribInterval = this.preferences.getIntPref("extensions.fzami.prayercal.maghribdelay");
		var ishaTwilight = this.preferences.getIntPref("extensions.fzami.prayercal.ishaangle");

		url += "&prayerCustomize=1&fajrTwilight1="+fajrTwilight+"&ishaTwilight="+ishaTwilight+"&dhuhrInterval="+dhuhrInterval+"&maghribInterval="+maghribInterval;
	}

	if (this.preferences && 
			this.preferences.getBoolPref("extensions.fzami.debug")) {
		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("nsPrayerTimes: getting prayer times with url: "+url);
	}

	return url;
  },

  onLoadPrayerTimes: function(aResponse, aStatus) { 
      if (!aResponse || aStatus > 200) {
        this.onErrorLoadingPrayerTimes(this.bundle.formatStringFromName("fzami.error.network-with-status", [aStatus], 1));
      } else {
      	try {
	        var prayertimes = this.parsePrayerTimes(aResponse);
	        var prayertimeString = "{fajr:'"+prayertimes["fajr"]+"', shuruk:'"+prayertimes["shuruk"]+"', zuhr:'"+prayertimes["zuhr"]+"', asr:'"+prayertimes["asr"]+"', maghrib:'"+prayertimes["maghrib"]+"', isha:'"+prayertimes["isha"]+"'}";

		  	if (this.preferences && 
				this.preferences.getBoolPref("extensions.fzami.debug")) {
		  	  Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService)
				.logStringMessage("nsPrayerTimes: Sending fzami:prayertimes-loaded with "+prayertimeString);
		  	}

	        Components.classes["@mozilla.org/observer-service;1"]
        	   .getService(Components.interfaces.nsIObserverService)
        	   .notifyObservers(this, "fzami:prayertimes-loaded", prayertimeString);
      	} catch (e){
		  this.onErrorLoadingPrayerTimes(e.message);
        }
      }
  },

  onErrorLoadingPrayerTimes: function(errorMsg) {
      this.lastRequest = null;
      this.lastRequestDate = null;
      if (typeof(errorMsg) == "undefined") errorMsg = this.bundle.GetStringFromName("fzami.error.network");
       
  	  if (this.preferences && 
	  		this.preferences.getBoolPref("extensions.fzami.debug")) {
  		Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("nsPrayerTimes: Sending fzami:prayertimes-error with "+errorMsg);
  	  }

       Components.classes["@mozilla.org/observer-service;1"]
        	.getService(Components.interfaces.nsIObserverService)
        	.notifyObservers(this, "fzami:prayertimes-error", errorMsg);
  },

  openOptionsDialog: function() {
          Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
        						.getService(Components.interfaces.nsIWindowWatcher)
        						.openWindow(null, "chrome://fzami/content/options.xul", "fzami-options", "chrome,centerscreen", null);
  },
  
  parsePrayerTimes: function(response) {
	if (response.indexOf("www.islamicfinder.org") == -1)
	{
		throw new Error(this.bundle.GetStringFromName("fzami.error.network"));
	}
	if (response.indexOf("Error#") != -1)
	{
		this.openOptionsDialog();
		throw new Error(this.bundle.GetStringFromName("fzami.error.pref-settings"));
	}

	response = response.toLowerCase();
	response = response.substring(response.indexOf("sunrise<"));
	response = response.substring(response.indexOf("<tr"));
	
	var today = new Date();
	response = response.substring(response.indexOf("center\">"+today.getDate()+"</td")+15);
	
	response = response.substring(0, response.indexOf("</tr>")+5);

	response = response.substring(response.indexOf("center\">")+8);
	response = response.substring(response.indexOf("center\">")+8);
	var fajr = this.newTime(response.substring(0, response.indexOf("</td")).trim());
	response = response.substring(response.indexOf("center\">")+8);
	var shuruk = this.newTime(response.substring(0, response.indexOf("</td")).trim());
	response = response.substring(response.indexOf("center\">")+8);
	var zuhr = this.newTime(response.substring(0, response.indexOf("</td")).trim());
	response = response.substring(response.indexOf("center\">")+8);
	var asr = this.newTime(response.substring(0, response.indexOf("</td")).trim());
	response = response.substring(response.indexOf("center\">")+8);
	var maghrib = this.newTime(response.substring(0, response.indexOf("</td")).trim());
	response = response.substring(response.indexOf("center\">")+8);
	var isha = this.newTime(response.substring(0, response.indexOf("</td")).trim());

	var inPM = zuhr.hour < fajr.hour;
        if (inPM) zuhr.hour += 12; else inPM = asr.hour < zuhr.hour;
        if (inPM) asr.hour += 12; else inPM = maghrib.hour < asr.hour;
        if (inPM) maghrib.hour += 12; else inPM = isha.hour < maghrib.hour;
        if (inPM) isha.hour += 12;

	var prayertimes = new Array;
	prayertimes['fajr'] = fajr.toString(true);
	prayertimes['shuruk'] = shuruk.toString(true);
	prayertimes['zuhr'] = zuhr.toString(true);
	prayertimes['asr'] = asr.toString(true);
	prayertimes['maghrib'] = maghrib.toString(true);
	prayertimes['isha'] = isha.toString(true);

	return prayertimes;
  },

  loadCitiesFor: function(countryName, cityName, callback)
  {
      var URL = null;
      try {
        URL = this.calculateCityListUrl(countryName, cityName);
      } catch(e) {
        callback([{error:this.bundle.formatStringFromName("fzami.error.city-list", [countryName], 1)}]);
	return;
      }

      //setup request and send
      var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
      request.open("GET", URL);
      var module = this;
      request.onload = function() { module.onLoadCities(callback, this.responseText, this.status); }
      request.onerror = function() { module.onErrorLoadingCities(callback); }
      try {
        if (request.channel instanceof Components.interfaces.nsISupportsPriority)
          request.channel.priority = Components.interfaces.nsISupportsPriority.PRIORITY_HIGHEST;
      } catch(e) {};
      request.send(null);
   },

   calculateCityListUrl: function(countryName, cityName)
   {
      return this.baseCitiesUrl+"city="+cityName+"&country="+countryName;
   },

   onLoadCities: function(callback, response, status)
       {
            var cities = new Array();
            if (!response || status > 200) {
               cities[0] = { "error": this.bundle.formatStringFromName("fzami.error.network-with-status", [status], 1) }
            } else if (response.indexOf("www.islamicfinder.org") == -1) {
               cities[0] = { "error": this.bundle.GetStringFromName("fzami.error.network") }
            } else if (response.indexOf("Please choose") != -1) {
            	cities[0] = { "error": this.bundle.GetStringFromName("fzami.error.too-many-cities") }
            } else if (response.indexOf("No town or city found") != -1) {
				cities[0] = { "error": this.bundle.GetStringFromName("fzami.error.no-cities") };
	    } else {
			var i = 0;
			var index = response.indexOf("<td class=\"IslamicData\">");
			while (index > -1) {
				var end = response.indexOf("</td>", index);
				var cityInfo = response.substring(index, end);
				response = response.substring(end);
				index = response.indexOf("<td class=\"IslamicData\">");
				
				var pattern = /href="[^"]*city=([^&"]+)[^#]+state=([^&"]+)[^>]*>([^<]+)<\/a>.*(?:State: (.*)\)<).*<sup>\(([^,]*), ([^\)]*)\)<\/sup>/;
				var matches = pattern.exec(cityInfo);
				if (matches != null) {
					cities[i++] = {"value": matches[1], "state": matches[2], "name": matches[3], "state_name": matches[4], "longitude": matches[5], "latitude": matches[6] };
				} else {
					pattern = /href="[^"]*city=([^&"]+)[^#]+state=([^&"]+)[^>]*>([^<]+)<\/a>.*<sup>\(([^,]*), ([^\)]*)\)<\/sup>/;
					matches = pattern.exec(cityInfo);
					if (matches != null) {
						cities[i++] = {"value": matches[1], "state": matches[2], "name": matches[3], "longitude": matches[4], "latitude": matches[5] };
					}
				}				
			}
		}
			if (cities.length == 0) {
				cities[i++] = { "error": this.bundle.GetStringFromName("fzami.error.no-cities") };
			}
            callback(cities);
       },


  onErrorLoadingCities: function(callback)
       {
            callback([{ error: this.bundle.GetStringFromName("fzami.error.network") }]);
       },


	isUSZipCode: function(zipcode)
	{
		return zipcode.match(/^\d{5}(-\d{4})?$/);
	},
	
	newTime: function(string) {
		return Components.classes["@mozdev.org/fzami/time;1"].createInstance().wrappedJSObject.initialize(string);
	}
	
};




/*
var myModule = { 
	_firstTime: true,
     myCID: Components.ID("{9F64D46C-64A5-11DB-8373-B622A1EF5492}"),
     myProgID: "@mozdev.org/fzami/ptservice;1",
 
     registerSelf: function (compMgr, fileSpec, location, type) {
	    if (this._firstTime) {
	      this._firstTime = false;
	      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
	    };
         compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
         compMgr.registerFactoryLocation(this.myCID,
                                         "Fzami Prayer Time Component",
                                         this.myProgID,
                                         fileSpec,
                                         location,
                                         type);
     },
 
     // The GetClassObject method is responsible for producing Factory objects
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
             return (new PrayerTimeService()).QueryInterface(iid);
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
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([PrayerTimeService]);
else
	var NSGetModule = XPCOMUtils.generateNSGetModule([PrayerTimeService]);
