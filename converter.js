// ==UserScript==
// @name         RohBot Currency Converter
// @version      1.22
// @description  Allows the user to select their currency and then converts any found currencies to the one the user selected
// @author       Spans
// @match        https://rohbot.net
// @grant        none
// @updateURL	 https://raw.githubusercontent.com/Spanfile/RohBot-Currency-Converter/master/converter.js
// @require		 http://openexchangerates.github.io/money.js/money.min.js
// ==/UserScript==

var cacheKey = "spans-currency-cache";
var storeKey = "spans-currency";
var enabled = false;
var user = "eur";

var currencies = {
	usd: { name: "USD", symbol: "$", pos: "pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)\$([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?)\$(?=\s|$|,|\.|!|\?|\*)/ig },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?)(?: dollars?)(?=\s|$|,|\.|!|\?|\*)/ig },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) penn(?:y|ies)(?=\s|$|,|\.|!|\?|\*)/ig, modifier: 0.01 }, 
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) nickels?(?=\s|$|,|\.|!|\?|\*)/ig, modifier: 0.05 },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) dimes?(?=\s|$|,|\.|!|\?|\*)/ig, modifier: 0.1 },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) quarters?(?=\s|$|,|\.|!|\?|\*)/ig, modifier: 0.25 }
	]},
	eur: { name: "EUR", symbol: "€", pos: "post", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?)(?:€|e| eur(?:o|os)?)(?=\s|$|,|\.|!|\?|\*)/ig },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)€([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig }
	]},
	gbp: { name: "GBP", symbol: "£", pos: "pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?)&#163;(?=\s|$|,|\.|!|\?|\*)/ig }, // the &#163; is for £
		{ regex: /(?:\s|^|,|\.|!|\?|\*)&#163;([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig },
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?)(?:p| pence)(?=\s|$|,|\.|!|\?|\*)/ig, modifier: 0.01}
	]},
	cad: { name: "CAD", symbol: "CA$", pos: "pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)CA\$([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig }]},
	aud: { name: "AUD", symbol: "A$", pos: "pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)A\$([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig }]},
	nzd: { name: "NZD", symbol: "NZ$", pos :"pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)NZ\$([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig }]},
	sek: { name: "SEK", symbol: " kr", pos: "post", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) ?kr(?=\s|$|,|\.|!|\?|\*)/ig }]}, // kr defaults to swedish kronor
	nok: { name: "NOK", symbol: " nok", pos: "post", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) ?nok(?=\s|$|,|\.|!|\?|\*)/ig }]}, // special cases for norwegian and danish kronor whatevers
	dkk: { name: "DKK", symbol: " dkk", pos: "post", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)([\d,]+(?:\.\d+)?) ?dkk(?=\s|$|,|\.|!|\?|\*)/ig }]},
	zar: { name: "ZAR", symbol: "R", pos: "pre", regexes: [
		{ regex: /(?:\s|^|,|\.|!|\?|\*)R([\d,]+(?:\.\d+)?)(?=\s|$|,|\.|!|\?|\*)/ig }]}
};

// first of all, setup the currency conversion
var cached = RohStore.get(cacheKey);
if (cached) {
	var cachedObj = JSON.parse(cached);
	fx.base = cachedObj.base;
	fx.rates = cachedObj.rates;
	enabled = true;
}

$.getJSON("https://api.fixer.io/latest", function(data) {
	if (typeof fx !== "undefined" && fx.rates) {
		fx.base = data.base;
		fx.rates = data.rates;
		enabled = true;
		cacheRates();
	}
	
	//console.log("Currency test: €1 = $" + fx(1).from("EUR").to("USD"));
});

function cacheRates() {
	RohStore.set(cacheKey, JSON.stringify({
		base: fx.base,
		rates: fx.rates
	}));
}

function load() {
	user = RohStore.get(storeKey) || "eur"; // haha fuck you americans
}

function save() {
	RohStore.set(storeKey, user);
}

chatMgr.lineFilter.add(function(line, prepend, e) {
	if (!enabled)
		return;
	
	line.Content = applyConversions(line.Content);
});

cmd.register("currency", "-", function(chat, args) {
	if (args.length != 1 || args[0].length === 0 || !currencies.hasOwnProperty(args[0])) {
		chat.statusMessage("Usage: /currency (" + Object.keys(currencies).join("|") + ")");
	}
	
	user = args[0];
	chat.statusMessage("Your preferred currency has been set to " + currencies[user].name);
	save();
});

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
		var title = formatCurrency(result.conversion, result.currency);
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
	
	from.regexes.forEach(function(regexModifierPair) {
		while ((m = regexModifierPair.regex.exec(message)) !== null) {
			if (m.index === regexModifierPair.regex.lastIndex) {
				regex.lastIndex++;
			}
			
			var amount = Number(m[1].replace(',', '.')) * (regexModifierPair.modifier || 1); // js wants dots as decimal separators
			var converted = Math.round(fx(amount).from(from.name).to(to.name) * 100) / 100; // two decimals is enough for currencies

			results[results.length] = {original: m[0], index: m.index, conversion: converted, currency: to};
		}
	});

	return results;
}

function formatCurrency(value, currency) {
	return currency.pos === "pre" ? currency.symbol + value : value + currency.symbol;
}

String.prototype.splice = function(idx, rem, s) {
	return (this.slice(0, idx) + s + this.slice(idx + Math.abs(rem)));
};

load();
