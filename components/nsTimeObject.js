const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");


function Time() {
	this.wrappedJSObject = this;
}

Time.prototype = {
	classDescription: "time object",
	contractID: "@mozdev.org/fzami/time;1",
	classID: Components.ID("{91873072-65EF-11DB-8373-B622A1EF5492}"),
	QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),

	hour: null,
	minute: null,  


  initialize: function(timeStr) {
	  var pieces = timeStr.split(":", 2);
	  this.hour = Number(pieces[0]);
	  this.minute = Number(pieces[1]);
	  return this;
  },
  
  before: function(date)
  {
    if (date.getHours() == this.hour) return this.minute <= date.getMinutes();
    return this.hour < date.getHours();
  },

  after: function(date)
  {
    return !this.before(date);
  },

  formatTime: function(militaryTime) 
  {
    if (isNaN(this.hour) || isNaN(this.minute)) return "---";
    var time = "";
    var isAm = true;
	if (!militaryTime) {
	    if (this.hour == 0) { time+="12:"; }
	    else if (this.hour == 12) { time+="12:"; isAm = false; }
	    else if (this.hour > 12) { time+=(this.hour-12)+":"; isAm = false; }
	    else { time+=this.hour+":"; }
	} else {
	    time+=this.hour+":";
	}
    time+=((this.minute < 10)?"0":"")+this.minute;
	if (!militaryTime) {
	    time+=(isAm?" am":" pm");
	}
    return time;
  }
};

/*
var myModule = { 
	_firstTime: true,
     myCID: Components.ID("{91873072-65EF-11DB-8373-B622A1EF5492}"),
     myProgID: "@mozdev.org/fzami/time;1",
     registerSelf: function (compMgr, fileSpec, location, type) {
	    if (this._firstTime) {
	      this._firstTime = false;
	      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
	    };
         compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
         compMgr.registerFactoryLocation(this.myCID,
                                         "Fzami Time Object",
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
             return (new Time()).QueryInterface(iid);
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
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([Time]);
else
	var NSGetModule = XPCOMUtils.generateNSGetModule([Time]);
