"use strict";

var bldhelper = execMain(function() {

	// bld scramble gen
	function enumCycles(n, k) {
		if (k == undefined) {
			var ret = [];
			for (var i = 0; i < n; i++) {
				var cur = enumCycles(n, i + 1);
				ret.push.apply(ret, cur);
			}
			return ret;
		}
		if (n < k || n < 1 || k < 1) {
			return [];
		} else if (n == k) {
			return [mathlib.valuedArray(n, 1)];
		}
		var rm1 = enumCycles(n - 1, k - 1);
		for (var i = 0; i < rm1.length; i++) {
			rm1[i].push(1);
		}
		var dec1 = enumCycles(n - k, k);
		for (var i = 0; i < dec1.length; i++) {
			var cur = dec1[i];
			for (var j = 0; j < cur.length; j++) {
				cur[j]++;
			}
		}
		return rm1.concat(dec1);
	}

	function cntPerms(cycles) {
		if (cycles.length == 0) {
			return 1;
		}
		var n = cycles[0];
		var curVal = cycles[0];
		var curCnt = 1;
		var remain = [];
		for (var i = 1; i < cycles.length; i++) {
			n += cycles[i];
			if (cycles[i] == curVal) {
				curCnt++;
			} else {
				remain.push(cycles[i]);
			}
		}
		var cur = 1;
		for (var i = 0; i < curCnt; i++) {
			cur *= mathlib.Cnk[n][curVal] * mathlib.fact[curVal - 1];
			cur /= (i + 1);
			n -= curVal;
		}
		return cur * cntPerms(remain);
	}

	function cntOris(n, base, nDone, nErr) {
		if (nDone + nErr > n) {
			return [0, null];
		}
		var cum = 0;
		var ret = [];
		for (var i = nDone; i < n - 1; i++) {
			var skip = (i < nDone + nErr) ? 1 : 0;
			var cur = mathlib.rn(base - skip) + skip;
			ret.push(cur);
			cum += cur;
		}
		if (nDone + nErr < n) { //at least 1 any
			ret.push((base * n - cum) % base);
			return [Math.pow(base - 1, nErr) * Math.pow(base, n - nDone - nErr - 1), mathlib.valuedArray(nDone, 0).concat(ret)];
		}
		var sum = mathlib.valuedArray(base, 0);
		sum[0] = 1;
		for (var i = 0; i < nErr; i++) {
			var sum2 = mathlib.valuedArray(base, 0);
			for (var j = 1; j < base; j++) {
				for (var k = 0; k < base; k++) {
					sum2[(j + k) % base] += sum[k];
				}
			}
			sum = sum2;
		}
		if (sum[0] == 0) {
			return [0, null];
		}
		var last = (base * n - cum) % base;
		while (last == 0 && nErr > 0) {
			cum = 0;
			ret = [];
			for (var i = nDone; i < n - 1; i++) {
				var skip = (i < nDone + nErr) ? 1 : 0;
				var cur = mathlib.rn(base - skip) + skip;
				ret.push(cur);
				cum += cur;
			}
			last = (base * n - cum) % base;
		}
		ret.push(last);
		return [sum[0], mathlib.valuedArray(nDone, 0).concat(ret)];
	}

	// buff: buffer cubie status bitmask (0 - done, 1 - flip, 2 - in cycles)
	// fixdone: num of fix-solved cubies (exclude buffer)
	// fixerr: num of fix-flipped cubies (exclude buffer)
	// nerrLR: total num of flipped cubies (include fixed, exclude buffer)
	// scycle: num of cycles without the buffer cubie
	// ncodeLR: num of encoded words without flips
	// return [cntValid, rndState]
	function getRandState(buff, fixDone, fixErr, nerrLR, scycleLR, ncodeLR, base, cycles, ignoreFlip) {
		var cycCnt = 0;
		var inpCnt = 0;
		var oupCnt = 0;
		for (var i = 0; i < cycles.length; i++) {
			if (cycles[i] == 1) {
				inpCnt++;
			} else {
				oupCnt += cycles[i];
				cycCnt++;
			}
		}
		if (ignoreFlip && (buff & 0x3) == 0x3) {
			buff &= ~2;
		}
		var cntValid = 0;
		var rndState = null;
		for (var i = 0; i < 3; i++) { // enum buff status
			if ((buff >> i & 1) == 0) {
				continue;
			}
			var scycle = cycCnt - (i >> 1);
			var ncode = oupCnt + cycCnt - (i >> 1) * 2;
			if (scycle < scycleLR[0] || scycle > scycleLR[1]
					|| ncode < ncodeLR[0] || ncode > ncodeLR[1]) {
				continue
			}
			var bufErr = i == 1 ? 1 : 0;
			var fixErr1 = fixErr + bufErr;
			var fixInp = fixDone + fixErr + (i < 2 ? 1 : 0);
			if (inpCnt < Math.max(fixInp, nerrLR[0] + bufErr) || fixErr > nerrLR[1]) {
				continue;
			}

			// calc oris
			var anyInp = inpCnt - fixInp;
			var cntFlip = 0;
			var flips = null;
			var anySamp = 0;
			for (var j = Math.max(nerrLR[0] - fixErr, 0); j <= Math.min(nerrLR[1] - fixErr, anyInp); j++) {
				var cur = cntOris(cycCnt + inpCnt, base, inpCnt - fixErr1 - j, fixErr1 + j);
				var curCnt = cur[0] * mathlib.Cnk[anyInp][j];
				cntFlip += curCnt;
				if (mathlib.rndHit(curCnt / cntFlip)) {
					flips = cur[1];
					anySamp = j;
				}
			}
			if (cntFlip == 0 && !ignoreFlip) {
				continue;
			}
			cntFlip *= Math.pow(base, oupCnt - cycCnt);

			// calc perms
			var cyclesR = cycles.slice(0, cycles.length - fixInp);
			var remainCnt = inpCnt + oupCnt - fixInp;
			var mulPerm = 1;
			while (cyclesR.length > 0) {
				var curLen = cyclesR.pop();
				var curCnt = 1;
				mulPerm *= mathlib.Cnk[remainCnt][curLen] * mathlib.fact[curLen - 1];
				remainCnt -= curLen;
				while (cyclesR[cyclesR.length - 1] == curLen) {
					cyclesR.pop();
					curCnt++;
					mulPerm *= mathlib.Cnk[remainCnt][curLen] * mathlib.fact[curLen - 1];
					mulPerm /= curCnt;
					remainCnt -= curLen;
				}
				if (curLen == 1 && i == 2) {
					mulPerm *= oupCnt;
					mulPerm /= inpCnt + oupCnt - fixInp;
				}
			}
			var curValid = (ignoreFlip ? 1 : cntFlip) * mulPerm;
			cntValid += curValid;
			if (!mathlib.rndHit(curValid / cntValid)) { // not sampled
				continue;
			}

			// flip sample
			var flipState = [];
			for (var j = 0; j < cycCnt; j++) {
				var cursum = flips.pop();
				var curLen = cycles[j];
				for (var k = 0; k < curLen - 1; k++) {
					var cur = mathlib.rn(base);
					flipState.push(cur);
					cursum += base - cur;
				}
				flipState.push(cursum % base);
			}
			var rndp = mathlib.rndPerm(anyInp);
			for (var j = 0; j < rndp.length; j++) {
				if (rndp[j] < anySamp) {
					flipState.push(flips.pop());
				} else {
					flipState.push(flips.shift());
				}
			}
			if (i < 2) {
				flipState.unshift(i == 0 ? flips.shift() : flips.pop());
				flipState.splice.apply(flipState, [1, 0].concat(flips));
			} else {
				flipState.splice.apply(flipState, [0, 0].concat(flips));
			}

			// perm sample
			cyclesR = cycles.slice(0, cycles.length - fixInp);
			var permState = [0];
			var rndState = [];
			var rmap = [0];
			var k = (i == 2) ? 1 : 0;
			if (k == 0) {
				rndState[0] = [0, flipState.shift()];
			}
			for (var j = 1; j < oupCnt + inpCnt; j++) {
				permState[j] = j;
				if (j >= 1 + fixDone + fixErr) {
					rmap[k] = j;
					k++;
				} else {
					rndState[j] = [j, flipState.shift()];
				}
			}
			remainCnt = inpCnt + oupCnt - fixInp;
			var perm = mathlib.rndPerm(remainCnt);
			if (i == 2 && perm.indexOf(0) >= oupCnt) {
				var offset = (perm.indexOf(0) - mathlib.rn(oupCnt) + remainCnt) % remainCnt;
				perm = perm.slice(offset).concat(perm.slice(0, offset));
			}
			var permCycles = [];
			for (var j = 0; j < cyclesR.length; j++) {
				var cur = perm.slice(0, cyclesR[j]);
				permCycles.push(cur);
				perm = perm.slice(cyclesR[j]);
				for (var k = 0; k < cur.length; k++) {
					permState[rmap[cur[k]]] = rmap[cur[(k + 1) % cur.length]];
					rndState[rmap[cur[k]]] = [rmap[cur[(k + 1) % cur.length]], flipState.shift()];
				}
			}
		}
		return [cntValid, rndState];
	}

	function getParity(cycles) {
		var p = 0;
		for (var i = 0; i < cycles.length; i++) {
			p ^= cycles[i] + 1;
		}
		return p & 1;
	}

	var bldSets = {
		'cbuff': [0, 0x7],
		'cfix': "",
		'cnerrLR': [0, 7],
		'cscycLR': [0, 3],
		'cncodeLR': [0, 10],
		'ebuff': [1, 0x7],
		'efix': "",
		'enerrLR': [0, 11],
		'escycLR': [0, 5],
		'encodeLR': [0, 16],
		'ceparity': 0x3
	};

	function procBLDSetEvent(e) {
		var obj = $(e.target);
		var key = obj.attr('id')
		if (!key) {
			return;
		}
		if (/^[ce]buff[01]$/.exec(key)) {
			bldSets[key.slice(0, 5)][~~key[5]] = ~~obj.val();
			calcResult();
		} else if (key.endsWith('LR')) {
			var m = /^(\d{1,2})-(\d{1,2})$/.exec(obj.val());
			if (!m) {
				m = /^((\d{1,2}))$/.exec(obj.val());
			}
			if (!m) {
				return;
			}
			var v1 = ~~m[1];
			var v2 = ~~m[2];
			bldSets[key] = [Math.min(v1, v2), Math.max(v1, v2)];
		} else if (key == 'ceparity') {
			bldSets[key] = ~~obj.val();
		} else if (key.endsWith('fix')){
			var cubies = pieces.split(' ');
			var fixs = obj.val().toUpperCase().split(' ');
			var fixMap = {};
			var val = [];
			var fixRe = /^(UR|UF|UL|UB|DR|DF|DL|DB|FR|FL|BL|BR)(\+?)$/;
			if (key == 'cfix') {
				var fixRe = /^(UFR|UFL|UBL|UBR|DFR|DFL|DBL|DBR)(\+?)$/;
			}
			for (var i = 0; i < fixs.length; i++) {
				var m = fixRe.exec(fixs[i]);
				if (m) {
					fixMap[m[1]] = m[2]
				}
			}
			for (var cubie in fixMap) {
				val.push(cubie + fixMap[cubie]);
			}
			bldSets[key] = val.join(' ');
		} else if (key == 'bldsClr') {
			bldSets = {
				'cbuff': [0, 0x7],
				'cfix': "",
				'cnerrLR': [0, 7],
				'cscycLR': [0, 3],
				'cncodeLR': [0, 10],
				'ebuff': [1, 0x7],
				'efix': "",
				'enerrLR': [0, 11],
				'escycLR': [0, 5],
				'encodeLR': [0, 16],
				'ceparity': 0x3
			};
		} else if (key == 'bldsEg') {
			bldSets = {
				'cbuff': [0, 0x7],
				'cfix': "UBL DFR+",
				'cnerrLR': [0, 7],
				'cscycLR': [0, 3],
				'cncodeLR': [0, 10],
				'ebuff': [1, 0x7],
				'efix': "DR DF+",
				'enerrLR': [0, 11],
				'escycLR': [0, 5],
				'encodeLR': [0, 16],
				'ceparity': 0x1
			};
		}
		genBLDSetTable(bldSets, setDiv);
	}

	function genBLDSetTable(bldSets, setDiv) {
		var s2r = function(key) {
			return bldSets[key][0] + '-' + bldSets[key][1];
		};
		setDiv = setDiv && setDiv.empty() || $('<table style="border-spacing:0">');
		var cbufSel = $('<select data="bufcorn" id="cbuff0">');
		var cbufFlt = $('<select id="cbuff1" style="width:2em">');
		var cFixTxt = $('<input id="cfix" type="text" style="width:4em" value="" pattern="[URFDLBurfdlb +]*">').val(bldSets['cfix']);
		var cErrTxt = $('<input id="cnerrLR" type="text" style="width:4em" value="" pattern="\d{1,2}-\d{1,2}">').val(s2r('cnerrLR'));
		var cNScTxt = $('<input id="cscycLR" type="text" style="width:4em" value="" pattern="\d{1,2}-\d{1,2}">').val(s2r('cscycLR'));
		var cNCoTxt = $('<input id="cncodeLR" type="text" style="width:4em" value="" pattern="\d{1,2}-\d{1,2}">').val(s2r('cncodeLR'));
		var ebufSel = $('<select data="bufedge" id="ebuff0">');
		var ebufFlt = $('<select id="ebuff1" style="width:2em">');
		var eFixTxt = $('<input id="efix" type="text" style="width:4em" value="" pattern="[URFDLBurfdlb +]*">').val(bldSets['efix']);
		var eErrTxt = $('<input id="enerrLR" type="text" style="width:4em" value="" pattern="\d{1,2}-\d{1,2}">').val(s2r('enerrLR'));
		var eNScTxt = $('<input id="escycLR" type="text" style="width:4em" value=""> pattern="\d{1,2}-\d{1,2}"').val(s2r('escycLR'));
		var eNCoTxt = $('<input id="encodeLR" type="text" style="width:4em" value="" pattern="\d{1,2}-\d{1,2}">').val(s2r('encodeLR'));
		var parityFlt = $('<select id="ceparity">');
		var bflts = [['any', 0x7], ['ok', 0x1], ['flip', 0x2], ['move', 0x4], ['not ok', 0x6], ['ok/flip', 0x3], ['ok/move', 0x5]];
		for (var i = 0; i < bflts.length; i++) {
			cbufFlt.append('<option value="' + bflts[i][1] + '">' + bflts[i][0] + '</option>');
			ebufFlt.append('<option value="' + bflts[i][1] + '">' + bflts[i][0] + '</option>');
		}
		var pflts = [['e/o any', 0x3], ['even', 0x1], ['odd', 0x2]];
		for (var i = 0; i < pflts.length; i++) {
			parityFlt.append('<option value="' + pflts[i][1] + '">' + pflts[i][0] + '</option>');
		}
		for (var i = 0; i < 8; i++) {
			var cur = pieces.slice(i * 4, i * 4 + 3);
			cbufSel.append('<option value="' + i + '">' + cur + '</option>');
		}
		for (var i = 0; i < 12; i++) {
			var cur = pieces.slice(32 + i * 3, 32 + i * 3 + 2);
			ebufSel.append('<option value="' + i + '">' + cur + '</option>');
		}
		cbufSel.val(bldSets['cbuff'][0]);
		ebufSel.val(bldSets['ebuff'][0]);
		cbufFlt.val(bldSets['cbuff'][1]);
		ebufFlt.val(bldSets['ebuff'][1]);
		parityFlt.val(bldSets['ceparity']);
		var ret = genBLDRndState(bldSets);
		setDiv.append($('<tr>').append('<th colspan=3>Scrambler|<span class="click" id="bldsClr">clr</span>|<span class="click" id="bldsEg">eg.</span></th>'));
		setDiv.append($('<tr>').append(parityFlt, '<th>Corner</th><th>Edge</th>'));
		setDiv.append($('<tr>').append('<td>buffer</td>', $('<td>').append(cbufSel, cbufFlt), $('<td>').append(ebufSel, ebufFlt)));
		setDiv.append($('<tr>').append('<td>fixed</td>', $('<td>').append(cFixTxt), $('<td>').append(eFixTxt)));
		setDiv.append($('<tr>').append('<td>flip</td>', $('<td>').append(cErrTxt), $('<td>').append(eErrTxt)));
		setDiv.append($('<tr>').append('<td>ex-cyc</td>', $('<td>').append(cNScTxt), $('<td>').append(eNScTxt)));
		setDiv.append($('<tr>').append('<td>#codes</td>', $('<td>').append(cNCoTxt), $('<td>').append(eNCoTxt)));
		setDiv.append($('<tr>').append('<td>probs</td>', $('<td colspan=2>').append(
			ret[0] < 432520032744 ? ret[0] : (Math.round(ret[0] / 43252003274489856000 * 100000000) / 1000000 + '%')
		)));
		setDiv.find('input,select').css({'padding':0}).unbind('change').change(procBLDSetEvent);
		setDiv.find('span.click').unbind('click').click(procBLDSetEvent);
		setDiv.find('td,th').css({'padding':0});
		return setDiv;
	}

	function genBLDRndState(bldSets, doScramble) {
		var cfixs = bldSets['cfix'].split(' ');
		var cfixDones = [];
		var cfixErrs = [];
		var fixRe = /^(UFR|UFL|UBL|UBR|DFR|DFL|DBL|DBR)(\+?)$/i;
		var cubies = pieces.split(' ');
		for (var i = 0; i < cfixs.length; i++) {
			var m = fixRe.exec(cfixs[i]);
			if (!m) {
				continue;
			} else if (m[1] == cubies[bldSets['cbuff'][0]]) { // buffer
				continue;
			} else if (m[2]) {
				cfixErrs.push(cubies.indexOf(m[1]));
			} else {
				cfixDones.push(cubies.indexOf(m[1]));
			}
		}
		var efixs = bldSets['efix'].split(' ');
		var efixDones = [];
		var efixErrs = [];
		var fixRe = /^(UR|UF|UL|UB|DR|DF|DL|DB|FR|FL|BL|BR)(\+?)$/i;
		for (var i = 0; i < efixs.length; i++) {
			var m = fixRe.exec(efixs[i]);
			if (!m) {
				continue;
			} else if (m[1] == cubies[bldSets['ebuff'][0] + 8]) { // buffer
				continue;
			} else if (m[2]) {
				efixErrs.push(cubies.indexOf(m[1]) - 8);
			} else {
				efixDones.push(cubies.indexOf(m[1]) - 8);
			}
		}

		var parityMask = bldSets['ceparity'];
		// corner count, group by parity
		var cvalid = [0, 0];
		var cSample = [null, null];
		var enum8 = enumCycles(8);
		for (var i = 0; i < enum8.length; i++) {
			var parity = getParity(enum8[i]);
			if ((parityMask >> parity & 1) == 0) {
				continue;
			}
			var ret = getRandState(bldSets['cbuff'][1], cfixDones.length, cfixErrs.length,
				bldSets['cnerrLR'], bldSets['cscycLR'], bldSets['cncodeLR'], 3, enum8[i]);
			cvalid[parity] += ret[0];
			if (mathlib.rndHit(ret[0] / cvalid[parity])) {
				cSample[parity] = ret[1];
			}
		}
		// edge count
		var evalid = [0, 0];
		var eSample = [null, null];
		var enum12 = enumCycles(12);
		for (var i = 0; i < enum12.length; i++) {
			var parity = getParity(enum12[i]);
			if ((parityMask >> parity & 1) == 0) {
				continue;
			}
			var ret = getRandState(bldSets['ebuff'][1], efixDones.length, efixErrs.length,
				bldSets['enerrLR'], bldSets['escycLR'], bldSets['encodeLR'], 2, enum12[i]);
			evalid[parity] += ret[0];
			if (mathlib.rndHit(ret[0] / evalid[parity])) {
				eSample[parity] = ret[1];
			}
		}
		var validCnt = cvalid[0] * evalid[0] + cvalid[1] * evalid[1];
		var ret = [validCnt, cSample[1], eSample[1]];
		if (mathlib.rndHit(cvalid[0] * evalid[0] / validCnt)) {
			ret = [validCnt, cSample[0], eSample[0]];
		}
		if (!doScramble) {
			return ret;
		}
		if (ret[0] == 0) {
			return "N/A";
		}
		var cornMap = [bldSets['cbuff'][0]].concat(cfixDones, cfixErrs);
		var edgeMap = [bldSets['ebuff'][0]].concat(efixDones, efixErrs);
		var cornIMap = [];
		var edgeIMap = [];
		for (var i = 0; i < 8; i++) {
			if (cornMap.indexOf(i) == -1) {
				cornMap.push(i);
			}
			cornIMap[cornMap[i]] = i;
		}
		for (var i = 0; i < 12; i++) {
			if (edgeMap.indexOf(i) == -1) {
				edgeMap.push(i);
			}
			edgeIMap[edgeMap[i]] = i;
		}
		var ca = [];
		var ea = [];
		for (var i = 0; i < 8; i++) {
			ca[cornMap[i]] = cornMap[ret[1][i][0]] | ret[1][i][1] << 3;
		}
		for (var i = 0; i < 12; i++) {
			ea[edgeMap[i]] = edgeMap[ret[2][i][0]] << 1 | ret[2][i][1];
		}
		var cc = new mathlib.CubieCube();
		cc.init(ca, ea);
		var facelet = cc.toFaceCube();
		return scramble_333.genFacelet(facelet).replace(/ +/g, ' ') || "U U'";
	}

	scrMgr.reg('nocache_333bldspec', function() {
		return genBLDRndState(bldSets, true);
	});

	// bld encoder
	var pieces = 'UFR UFL UBL UBR DFR DFL DBL DBR UR UF UL UB DR DF DL DB FR FL BL BR';
	var ChiChu = 'JLK ABC DFE GHI XYZ WNM OPQ RTS GH AB CD EF OP IJ KL MN QR ST WX YZ';
	var Speffz = 'CJM DIF ARE BQN VKP ULG XSH WTO BM CI DE AQ VO UK XG WS JP LF RH TN';
	var schemeSelect;

	function getBLDcode(c, scheme, cbuf, ebuf) {
		var corns = [];
		for (var i = 0; i < 8; i++) {
			corns[i] = scheme.slice(i * 4, i * 4 + 3);
		}
		var edges = [];
		for (var i = 0; i < 12; i++) {
			edges[i] = scheme.slice(32 + i * 3, 32 + i * 3 + 2);
		}

		var ccode = [];
		var ecode = [];
		var cc = new mathlib.CubieCube();
		cc.init(c.ca, c.ea);

		var done = 1 << cbuf;
		for (var i = 0; i < 8; i++) {
			if (cc.ca[i] == i) {
				done |= 1 << i;
			}
		}
		while (done != 0xff) {
			var target = cc.ca[cbuf] & 0x7;
			if (target == cbuf) { // buffer in place, swap with any unsolved
				var i = -1;
				while (done >> ++i & 1) {}
				mathlib.circle(cc.ca, i, cbuf);
				ccode.push(i);
				continue;
			}
			ccode.push(cc.ca[cbuf]);
			cc.ca[cbuf] = (cc.ca[target] + (cc.ca[cbuf] & 0xf8)) % 24;
			cc.ca[target] = target;
			done |= 1 << target;
		}

		done = 1 << ebuf;
		for (var i = 0; i < 12; i++) {
			if (cc.ea[i] == i * 2) {
				done |= 1 << i;
			}
		}
		while (done != 0xfff) {
			var target = cc.ea[ebuf] >> 1;
			if (target == ebuf) { // buffer in place, swap with any unsolved
				var i = -1;
				while (done >> ++i & 1) {}
				mathlib.circle(cc.ea, i, ebuf);
				ecode.push(i * 2);
				continue;
			}
			ecode.push(cc.ea[ebuf]);
			cc.ea[ebuf] = cc.ea[target] ^ (cc.ea[ebuf] & 1);
			cc.ea[target] = target << 1;
			done |= 1 << target;
		}
		var ret = [[], []];
		for (var i = 0; i < ccode.length; i++) {
			var val = ccode[i];
			ret[0].push(corns[val & 0x7].charAt((3 - (val >> 3)) % 3));
			if (i % 2 == 1) {
				ret[0].push(' ');
			}
		}
		for (var i = 0; i < ecode.length; i++) {
			var val = ecode[i];
			ret[1].push(edges[val >> 1].charAt(val & 1));
			if (i % 2 == 1) {
				ret[1].push(' ');
			}
		}
		return ret;
	}

	function procSchemeChange(e) {
		var target = $(e.target);
		kernel.blur();
		var val = target.val();
		var data = target.attr('data');
		if (data == 'scheme') {
			target.val('Scheme');
			if (val == 'speffz') {
				scheme = Speffz;
			} else if (val == 'chichu') {
				scheme = ChiChu;
			} else if (val == 'custom') {
				var ret = prompt('Code for ' + pieces, scheme);
				if (!ret) {
					return;
				}
				if (!/^([0-9A-Z]{3} ){8}([0-9A-Z]{2} ){11}[0-9A-Z]{2}$/i.exec(ret)) {
					alert('Invalid Scheme!');
					return;
				}
				scheme = ret.toUpperCase();
			}
		}
		calcResult();
	}

	var scheme = Speffz;
	var codeDiv = $('<div>');
	var setDiv = $('<table style="border-spacing:0" class="table">');

	function calcResult() {
		var scramble = tools.getCurScramble();
		var state = cubeutil.getScrambledState(scramble);
		var codes = getBLDcode(state, scheme, bldSets['cbuff'][0], bldSets['ebuff'][0]);
		codeDiv.html('C: ' + codes[0].join('') + '<br>' + 'E: ' + codes[1].join(''));
	}

	function execFunc(fdiv) {
		if (!fdiv) {
			return;
		}
		if (!tools.isPuzzle('333')) {
			fdiv.html(IMAGE_UNAVAILABLE);
			return;
		}
		fdiv.empty().append(setDiv, schemeSelect, codeDiv);
		schemeSelect.unbind('change').change(procSchemeChange);
		genBLDSetTable(bldSets, setDiv);
		calcResult();
	}

	$(function() {
		schemeSelect = $('<select data="scheme">');
		var schemes = [['', 'Scheme'], ['speffz', 'Speffz'], ['chichu', 'ChiChu'], ['custom', 'Custom']];
		for (var i = 0; i < schemes.length; i++) {
			schemeSelect.append('<option value="' + schemes[i][0] + '">' + schemes[i][1] + '</option>');
		}
		tools.regTool('bldhelper', TOOLS_BLDHELPER, execFunc);
	});
});
