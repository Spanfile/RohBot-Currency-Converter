// ==UserScript==
// @name         RohBot Currency Converter
// @version      1.7
// @description  Allows the user to select their currency and then converts any found currencies to the one the user selected
// @author       Spans
// @match        https://rohbot.net
// @grant        none
// @updateURL	 https://raw.githubusercontent.com/Spanfile/RohBot-Currency-Converter/master/converter.js
// @require		 http://openexchangerates.github.io/money.js/money.min.js
// @require		 http://code.jquery.com/jquery-2.1.4.min.js
// ==/UserScript==

// first of all, setup the currency conversion
$.getJSON("https://api.fixer.io/latest", function(data) {
	if (typeof fx !== "undefined" && fx.rates) {
		fx.rates = data.rates;
		fx.base = data.base;
	} else {
		var fxSetup = {
			rates: data.rates,
			base: base.rates
		};
	}
	
	//console.log("Currency test: €1 = $" + fx(1).from("EUR").to("USD"));
});

chatMgr.lineFilter.add(function(line, prepend, e) {
	line.Content = applyConversions(line.Content);
});

var user = "eur";

// the &#163; is for £
var currencies = {
	usd: { regexes: [ /(?:\s|^)\$(\d+(?:(?:\.|,)\d+)?)(?=\s|$)/ig, /(?:\s|^)(\d+(?:(?:\.|,)\d+)?)(?: dollars)(?=\s|$)/ig ], name: "USD" },
	eur: { regexes: [ /(?:\s|^)(\d+(?:(?:\.|,)\d+)?)€(?=\s|$)/ig ], name: "EUR" },
	gbp: { regexes: [ /(?:\s|^)(\d+(?:(?:\.|,)\d+)?)&#163;(?=\s|$)/ig ], name: "GBP" },
	cad: { regexes: [ /(?:\s|^)CA\$(\d+(?:(?:\.|,)\d+)?)(?=\s|$)/ig ], name: "CAD" },
	aud: { regexes: [ /(?:\s|^)A\$(\d+(?:(?:\.|,)\d+)?)(?=\s|$)/ig ], name: "AUD" },
	nzd: { regexes: [ /(?:\s|^)NZ\$(\d+(?:(?:\.|,)\d+)?)(?=\s|$)/ig ], name: "NZD" },
	sek: { regexes: [ /(?:\s|^)(\d+(?:(?:\.|,)\d+)?) ?kr(?=\s|$)/ig ], name: "SEK" },
};

function applyConversions(message) {
	var results = [];
	var userCurrency = currencies[user.toLowerCase()]; // toLowerCase() in case it's in upper case
	
	// try to find and convert any currencies except the users currency found in the message to the users currency
	for (var key in currencies) {
		if (currencies.hasOwnProperty(key)) { // hasOwnProperty() makes sure we don't loop over stuff inherited from the object's prototype
			var currency = currencies[key];
			
			if (currency.name != userCurrency.name) {
				var result = commonConversion(message, currency, userCurrency);
				
				if (result.length > 0) {
					results.push(result);
				}
			}
		}
	}
	
	// since the converters can return multiple conversions, flatten the results
	// the result looks like [[{stuff here}, {stuff here}], [{stuff here}, {stuff here}]]
	// flattening it turns it into [{stuff here}, {stuff here}, {stuff here}, {stuff here}]
	var flattened = [].concat.apply([], results);
	
	// sort them
	flattened.sort(function(a, b) {
		if (a.index > b.index) {
			return 1;
		}
		
		if (a.index < b.index) {
			return -1;
		}
		
		return 0;
	});

	var newMsg = message;
	var inserted = 0;
	// combine them all
	flattened.forEach(function(result) {
		var title = result.conversion.toLocaleString("en-IN", {style: "currency", currency: result.unit});
		var original = result.original;
		var begin = "";
		
		// because the js regex engine doesn't support positive lookbehinds, the regexes return the whitespace before every match
		// most of the time they do it unless the match is at the start of the message
		// in case there is a whitespace, remove it and have one added before the <abbr> tag
		if (original.substring(0, 1) == " ") {
			original = original.substring(1);
			begin = " ";
		}
		
		var toInsert = begin + "<abbr title=\"" + title + "\" style=\"cursor:help; border-bottom:1px dotted #777\">" + original + "</abbr>";
		newMsg = newMsg.splice(result.index + inserted, result.original.length, toInsert);
		inserted += toInsert.length - result.original.length;
	});

	return newMsg;
}

function commonConversion(message, from, to) {
	var m;
	var results = [];
	
	from.regexes.forEach(function(regex) {
		while ((m = regex.exec(message)) !== null) {
			if (m.index === regex.lastIndex) {
				regex.lastIndex++;
			}

			var amount = Number(m[1].replace(',', '.')); // js wants dots as decimal separators
			var converted = Math.round(fx(amount).from(from.name).to(to.name) * 100) / 100; // two decimals is enough for currencies

			results[results.length] = {original:m[0], index:m.index, conversion:converted, unit:to.name};
		}
	});

	return results;
}

String.prototype.splice = function(idx, rem, s) {
	return (this.slice(0, idx) + s + this.slice(idx + Math.abs(rem)));
};
