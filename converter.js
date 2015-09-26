// ==UserScript==
// @name         RohBot Currency Converter
// @version      1.1
// @description  Allows the user to select their currency and then converts any found currencies to the one the user selected
// @author       Spans
// @match        https://rohbot.net
// @grant        none
// @updateURL	 https://raw.githubusercontent.com/Spanfile/RohBot-Currency-Converter/master/converter.js
// ==/UserScript==

chatMgr.lineFilter.add(function(line, prepend, e) {
	line.Content = applyConversions(line.Content);
});

var user = "usd";

var conversions = {
	usd: {
		eur: function(message) { return commonConversion(message, /(?:\s|^)(\d+(?:(?:\.|,)\d+)?)(€)(?=\s|$)/ig, 1.11972, "USD") },
	},
	eur: {
		usd: function(message) { return commonConversion(message, /(?:\s|^)(\$)(\d+(?:(?:\.|,)\d+)?)?(?=\s|$)/ig, 0.8930, "EUR"); },
	},
};

function applyConversions(message) {
	var results = new Array();
	var userConversion = conversions[user];
	
	for (var converter in userConversion) {
		if (userConversion.hasOwnProperty(converter)) {
			var result = userConversion[converter](message);
			
			if (result.length > 0) {
				results.push(result);
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

function commonConversion(message, regex, rate, unit) {
	var m;
	var results = [];
	while ((m = regex.exec(message)) !== null) {
		if (m.index === regex.lastIndex) {
			regex.lastIndex++;
		}

		var amount = Number(m[1].replace(',', '.')); // js wants dots as decimal separators
		var converted = Math.round((amount * rate) * 100) / 100; // two decimals is enough for currencies
		
		results[results.length] = {original:m[0], index:m.index, conversion:converted, unit:unit};
	}

	return results;
}

String.prototype.splice = function(idx, rem, s) {
	return (this.slice(0, idx) + s + this.slice(idx + Math.abs(rem)));
};
