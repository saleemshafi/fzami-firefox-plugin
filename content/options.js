
function fzamiAcceptPreferences()
{
  var preferences = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
                      
  var alertFile = document.getElementById("fzami-general-alert-start-audio-file");
  if (alertFile != null) {
  	preferences.setCharPref("extensions.fzami.alert.start.audio.filename", alertFile.value);
  }
                                
  var citystate = document.getElementById("fzami-location-citystate");
  if (citystate.value != null && citystate.value != "") {
  	var val = citystate.value;
  	var city = val.substring(val.indexOf("|")+1);
  	var state = val.substring(0, val.indexOf("|"));
  	preferences.setCharPref("extensions.fzami.location.city", city);
  	preferences.setCharPref("extensions.fzami.location.state", state);
  	preferences.setCharPref("extensions.fzami.location.city.name", citystate.label);
  } else {
  	try { preferences.clearUserPref("extensions.fzami.location.city"); } catch(e) {}
  	try { preferences.clearUserPref("extensions.fzami.location.state"); } catch(e) {}
  	try { preferences.clearUserPref("extensions.fzami.location.city.name"); } catch(e) {}
  }
                                
  if (preferences && 
  		preferences.getBoolPref("extensions.fzami.debug")) {
	Components.classes["@mozilla.org/consoleservice;1"]
			.getService(Components.interfaces.nsIConsoleService)
			.logStringMessage("options: Sending fzami:preferences-changed with null");
  }
	
  Components.classes["@mozilla.org/observer-service;1"]
     .getService(Components.interfaces.nsIObserverService)
     .notifyObservers(null, "fzami:preferences-changed", null);

	var service = Components.classes["@mozdev.org/fzami/component;1"].getService().wrappedJSObject;
  	service.reloadPrayerTimes();
  	service.recalculateCurrentPrayer();
}

function fzamiValidatePreferences()
{
	return true;
}

function fzamiPreferencesLoaded()
{
    var countryList = document.getElementById("fzami-location-country");
    countryList.addEventListener("ValueChange", clearCities, false);
	clearCities();
		
	var preferences = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
    try {
	 	var city = preferences.getCharPref("extensions.fzami.location.city");
	 	var state = null; 
	 	try { state = preferences.getCharPref("extensions.fzami.location.state"); } catch(e) { state = ""; }
	 	var city_name = null; 
	 	try { city_name = preferences.getCharPref("extensions.fzami.location.city.name"); } catch (e) { city_name = city; }
		setCities([{"value":state+"|"+city, "name":city_name }]);
    } catch (e) {}
    
    updateAlerts();
}


function clearCities()
{
	var searchBox = document.getElementById("fzami-location-city-search");
    var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
    	.getService(Components.interfaces.nsIStringBundleService)  
		.createBundle("chrome://fzami/locale/fzami.properties");

	searchBox.value = bundle.GetStringFromName("fzami.search_cities");
	searchBox.focus();
	searchBox.select();
	
    var cityList = document.getElementById("fzami-location-citystate");
    cityList.value = "";
    cityList.selectedIndex = -1;
    while (cityList.menupopup.childNodes.length > 0)
    {
        cityList.menupopup.removeChild(cityList.menupopup.childNodes[0]);
    }
    var infoElement = document.createElement("menuitem");
    infoElement.setAttribute("value", "");
    infoElement.setAttribute("label", "<Use the box above to search for a city/state>");
    cityList.menupopup.appendChild(infoElement);
    cityList.selectedIndex = 0;
    
    var countryList = document.getElementById("fzami-location-country");
    var is_country_selected = countryList.value != null && countryList.value != "";
    searchBox.disabled = !is_country_selected;
    cityList.disabled = !is_country_selected;
}

var reloadCitiesTimeout = null;
function reloadCities()
{
	if (reloadCitiesTimeout != null) {
		clearTimeout(reloadCitiesTimeout);
	}
    var countryList = document.getElementById("fzami-location-country");
    var citySearch = document.getElementById("fzami-location-city-search");
    var cityList = document.getElementById("fzami-location-citystate");
    while (cityList.menupopup.childNodes.length > 0)
    {
        cityList.menupopup.removeChild(cityList.menupopup.childNodes[0]);
    }
    var country = countryList.selectedItem.value;
    cityList.selectedIndex = -1;
    if (country != "" && citySearch.value != "")
    {
    	reloadCitiesTimeout = setTimeout("Components.classes[\"@mozdev.org/fzami/ptservice;1\"].getService().wrappedJSObject.loadCitiesFor('"+country+"', '"+citySearch.value+"', setCities)", 500);
//    	Components.classes["@mozdev.org/fzami/ptservice;1"].getService().wrappedJSObject.loadCitiesFor(country, citySearch.value, setCities);
    } else {
	    var infoElement = document.createElement("menuitem");
	    infoElement.setAttribute("value", "");
	    infoElement.setAttribute("label", "<Use the box above to search for a city/state>");
	    cityList.menupopup.appendChild(infoElement);
	    cityList.selectedIndex = 0;
    }
    return true;
}

function setCities(cityArray)
{
	if (document) {  // this will be false if we closed the window
	    var cityList = document.getElementById("fzami-location-citystate");
	    while (cityList.menupopup.childNodes.length > 0)
	    {
	        cityList.menupopup.removeChild(cityList.menupopup.childNodes[0]);
	    }
	    for (var i = 0; i < cityArray.length; i++)
	    {
	        var city = cityArray[i];
	        var cityElement = document.createElement("menuitem");
	        if (city.error != null) {
	        	cityElement.setAttribute("value", "");
	        	cityElement.setAttribute("label", city.error);
	        } else if (city.value.indexOf("|") > -1){
		        cityElement.setAttribute("value", city.value);
		        cityElement.setAttribute("label", city.name);
	        } else {
		        cityElement.setAttribute("value", city.state+"|"+city.value);
		        var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
		        	.getService(Components.interfaces.nsIStringBundleService)  
					.createBundle("chrome://fzami/locale/fzami.properties");
		        var long_lat_str = bundle.formatStringFromName("fzami.longlat", [city.longitude, city.latitude], 2);
		        cityElement.setAttribute("label", city.name+( city.state_name != null ? ", "+city.state_name : "")+"  "+long_lat_str);
	        }
	        cityList.menupopup.appendChild(cityElement);
	    }
	    if (cityArray.length > 0)
		{
			cityList.selectedIndex = 0;
		}
	}
}

function selectAzanFile()
{
    var picker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
    picker.appendFilter("WAV Files", "*.wav");

    picker.defaultExtension = ".wav";
    picker.init(window, "Audio File Picker", Components.interfaces.nsIFilePicker.modeOpen);
    
    // get the file and its contents
    var res = picker.show();
    if (res == Components.interfaces.nsIFilePicker.returnCancel)
      return;

	var filename = "";
	if (picker.file != null) {
    	filename = picker.file.target;
	}
	var fileElement = document.getElementById("fzami-general-alert-start-audio-file");
	fileElement.value = filename;
}

var NUMERIC_MASK = /^\d*$/;
var DECIMAL_MASK = /^\d*(\d\.\d*)?$/;
var ZIPCODE_MASK = /^(((\d{0,5})|(\d{5}-\d{0,4}))|([A-Z](\d([A-Z]( (\d([A-Z](\d)?)?)?)?)?)?))$/;

function applyMask(event, mask)
{
     var field = event.target;
     var key = event.which;
	 if (key >= 32 && key < 127) {
          var ch = String.fromCharCode(key);
          var str = field.value + ch;
          if ( !mask.test(str) ) {
	          event.preventDefault();
	          event.stopPropagation();
          }
     }
}


function updateAlerts()
{
	var startAlertEnabled = document.getElementById("fzami-general-alert-start").checked;
	document.getElementById("fzami-general-alert-start-confirm").disabled = !startAlertEnabled;
	document.getElementById("fzami-general-alert-start-audio").disabled = !startAlertEnabled;
	var startAlertSoundEnabled = startAlertEnabled && document.getElementById("fzami-general-alert-start-audio").checked;
	document.getElementById("fzami-general-alert-start-audio-file").disabled = !startAlertSoundEnabled;
	document.getElementById("fzami-general-alert-start-audio-file-button").disabled = !startAlertSoundEnabled;
	
	var endAlertEnabled = document.getElementById("fzami-general-alert-end").checked;
	document.getElementById("fzami-general-alert-end-buffer").disabled = !endAlertEnabled;
	document.getElementById("fzami-general-alert-end-confirm").disabled = !endAlertEnabled;
}
