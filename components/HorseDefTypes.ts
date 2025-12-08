import skills from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

export function isDebuffSkill(id: string) {
	// iconId 3xxxx is the debuff icons
	// i think this basically matches the intuitive behavior of being able to add multiple debuff skills and not other skills;
	// e.g. there are some skills with both a debuff component and a positive component and typically it doesnt make sense to
	// add multiple of those
	return skillmeta[id].iconId[0] == '3';
}

export function SkillSet(ids): Map<(typeof skillmeta)['groupId'], keyof typeof skills> {
	return new Map(ids.reduce((acc, id) => {
		const {entries, ndebuff} = acc;
		const groupId = skillmeta[id].groupId;
		if (isDebuffSkill(id)) {
			entries.push([groupId + '-' + ndebuff, id]);
			return {entries, ndebuff: ndebuff + 1};
		} else {
			entries.push([groupId, id]);
			return {entries, ndebuff};
		}
	}, {entries: [], ndebuff: 0}).entries);
}

export type Aptitude = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface HorseState {
	outfitId: string
	speed: number
	stamina: number
	power: number
	guts: number
	wisdom: number
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige'
	distanceAptitude: Aptitude
	surfaceAptitude: Aptitude
	strategyAptitude: Aptitude
	skills: Map<(typeof skillmeta)['groupId'], keyof typeof skills>
	mood: -1 | -2 | 0 | 1 | 2;
	popularity: number
}

export const DEFAULT_HORSE_STATE = {
	outfitId: '',
	speed:   CC_GLOBAL ? 1200 : 1850,
	stamina: CC_GLOBAL ? 1200 : 1700,
	power:   CC_GLOBAL ? 800 : 1700,
	guts:    CC_GLOBAL ? 400 : 1200,
	wisdom:  CC_GLOBAL ? 400 : 1300,
	strategy: 'Senkou',
	distanceAptitude: 'S',
	surfaceAptitude: 'A',
	strategyAptitude: 'A',
	skills: SkillSet([]),
	mood: 2,
	popularity: 1
};

// This does introduce a duplication of (de)serialization code between HorseDefTypes.tsx and app.tsx - good enough for now
export async function serializeUma(uma: HorseState) {
	const json = JSON.stringify(uma);
	const enc = new TextEncoder();
	const stringStream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(json));
			controller.close();
		}
	});
	const zipped = stringStream.pipeThrough(new CompressionStream('gzip'));
	const reader = zipped.getReader();
	let buf = new Uint8Array();
	let result;
	while ((result = await reader.read())) {
		if (result.done) {
			return encodeURIComponent(btoa(String.fromCharCode(...buf)));
		} else {
			buf = new Uint8Array([...buf, ...result.value]);
		}
	}
}

export async function deserializeUma(hash: string) {
	const zipped = atob(decodeURIComponent(hash.trim().replace(/['"]+/g, '')));
	const buf = new Uint8Array(zipped.split('').map(c => c.charCodeAt(0)));
	const stringStream = new ReadableStream({
		start(controller) {
			controller.enqueue(buf);
			controller.close();
		}
	});
	const unzipped = stringStream.pipeThrough(new DecompressionStream('gzip'));
	const reader = unzipped.getReader();
	const decoder = new TextDecoder();
	let json = '';
	let result;
	while ((result = await reader.read())) {
		if (result.done) {
			const o = JSON.parse(json);
			const NEW_HORSE_FIELDS = Object.freeze({mood: 2, popularity: 1});  // added later
			const uma = Object.assign({}, NEW_HORSE_FIELDS, o, {skills: SkillSet(o.skills)});
			console.log('Deserialized uma', uma);
			return uma;
		} else {
			json += decoder.decode(result.value);
		}
	}
}
