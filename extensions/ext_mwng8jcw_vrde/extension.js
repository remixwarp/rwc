/*
   Created with CB-ExtGallary
   https://chessbrain.qzz.io/CB-ExtGallary
   QQ Group: https://qm.qq.com/q/xWWYbY59Ys
   Discord: https://discord.gg/5EZ2Ngreys
   Bilibili: https://space.bilibili.com/3546720759712433
*/
(async function (Scratch) {
const variables = {};


if (!Scratch.extensions.unsandboxed) {
    alert("该扩展需要在非沙箱（unsandboxed）模式下运行！")
    return
}

const ExtForge = {
    Broadcasts: new function() {
        this.raw_ = {};
        this.register = (name, blocks) => {
            this.raw_[name] = blocks;
        };
        this.execute = async (name) => {
            if (this.raw_[name]) {
                await this.raw_[name]();
            };
        };
    },

    Variables: new function() {
        this.raw_ = {};
        this.set = (name, value) => {
            this.raw_[name] = value;
        };
        this.get = (name) => {
            return this.raw_[name] ?? null;
        }
    },

    Vector: class {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }

        static from(v) {
            if (v instanceof ExtForge.Vector) return v
            if (v instanceof Array) return new ExtForge.Vector(Number(v[0]), Number(v[1]))
            if (v instanceof Object) return new ExtForge.Vector(Number(v.x), Number(v.y))
            return new ExtForge.Vector()
        }

        add(v) {
            return new ExtForge.Vector(this.x + v.x, this.y + v.y);
        }

        set(x, y) {
            return new ExtForge.Vector(x ?? this.x, y ?? this.y)
        }
    },

    Utils: {
        setList: (list, index, value) => {
            [...list][index] = value;
            return list;
        },
        uniqueList: (list) => {
            return [...new Set(list ?? [])];
        },
        sortList: (list, mode) => {
            const source = [...(list ?? [])];
            if (mode === "num_asc") return source.sort((a, b) => Number(a) - Number(b));
            if (mode === "num_desc") return source.sort((a, b) => Number(b) - Number(a));
            if (mode === "text_desc") return source.sort((a, b) => String(b).localeCompare(String(a)));
            return source.sort((a, b) => String(a).localeCompare(String(b)));
        },
        filterContains: (list, text) => {
            const query = String(text ?? "").toLowerCase();
            return (list ?? []).filter(v => String(v).toLowerCase().includes(query));
        },
        lists_foreach: {
            index: [0],
            value: [null],
            depth: 0
        },
        countString: (x, y) => {
            return y.length == 0 ? 0 : x.split(y).length - 1
        }
    },

    Music: new function() {
        this.context = null;
        this.masterGain = null;
        this.activeNodes = new Set();
        this.volume = 0.5;
        this.bpm = 120;

        this.ensureContext = () => {
            if (!this.context) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) {
                    throw new Error("Web Audio API is not supported in this environment.");
                }
                this.context = new AudioContextClass();
                this.masterGain = this.context.createGain();
                this.masterGain.gain.value = this.volume;
                this.masterGain.connect(this.context.destination);
            }
            if (this.context.state === "suspended") {
                this.context.resume();
            }
        };

        this.setVolume = (value) => {
            this.ensureContext();
            const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
            this.volume = safeValue / 100;
            this.masterGain.gain.value = this.volume;
        };

        this.getVolume = () => {
            return Math.round(this.volume * 100);
        };

        this.playTone = async (frequency, durationMs) => {
            this.ensureContext();
            const safeFrequency = Math.max(20, Number(frequency) || 440);
            const safeDuration = Math.max(0, Number(durationMs) || 200);

            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = safeFrequency;

            gain.gain.setValueAtTime(0, this.context.currentTime);
            gain.gain.linearRampToValueAtTime(1, this.context.currentTime + 0.01);
            gain.gain.linearRampToValueAtTime(0, this.context.currentTime + safeDuration / 1000);

            oscillator.connect(gain);
            gain.connect(this.masterGain);
            oscillator.start();
            oscillator.stop(this.context.currentTime + safeDuration / 1000 + 0.02);
            this.activeNodes.add(oscillator);

            await new Promise(resolve => setTimeout(resolve, safeDuration));
            this.activeNodes.delete(oscillator);
        };

        this.stopAll = () => {
            for (const oscillator of this.activeNodes) {
                try {
                    oscillator.stop();
                } catch {}
            }
            this.activeNodes.clear();
        };

        this.noteToFrequency = (note) => {
            const match = String(note ?? "A4").trim().toUpperCase().match(/^([A-G])([#B]?)(-?d)$/);
            if (!match) return 440;
            const [, pitch, accidental, octaveRaw] = match;
            const octave = Number(octaveRaw);
            const table = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
            let semitone = table[pitch] ?? 0;
            if (accidental === "#") semitone += 1;
            if (accidental === "B") semitone -= 1;
            semitone += (octave - 4) * 12;
            return 440 * (2 ** (semitone / 12));
        };

        this.setTempo = (bpm) => {
            this.bpm = Math.max(20, Math.min(320, Number(bpm) || 120));
        };
        this.getTempo = () => this.bpm;

        this.playNote = async (note, beats) => {
            const durationMs = (60000 / this.bpm) * Math.max(0, Number(beats) || 1);
            const frequency = this.noteToFrequency(note);
            await this.playTone(frequency, durationMs);
        };

        this.rest = async (beats) => {
            const durationMs = (60000 / this.bpm) * Math.max(0, Number(beats) || 1);
            await new Promise(resolve => setTimeout(resolve, durationMs));
        };
    }
}

class Extension {
getInfo() {
   return {"id":"meiyong","name":"没用工具箱","color1":"#ff7070","blocks":[{"opcode":"block_86952433254774e5","text":"返回真","blockType":"Boolean","arguments":{}},{"opcode":"block_b0514ebc8b7bc019","text":"返回假","blockType":"Boolean","arguments":{}},{"opcode":"block_7c8573ff01713bcc","text":"返回随机布尔","blockType":"Boolean","arguments":{}},{"opcode":"block_205857f743b7abc5","text":"Pi","blockType":"reporter","arguments":{}},{"opcode":"block_24d3b6524a597921","text":"e","blockType":"reporter","arguments":{}},{"opcode":"block_4d2c2876122245d7","text":"反向布尔 [c171d3dce0595e93]","blockType":"Boolean","arguments":{"c171d3dce0595e93":{"type":"Boolean"}}},{"opcode":"block_2d4868b7394df34f","text":"∞","blockType":"reporter","arguments":{}},{"opcode":"block_35d11c36683c84f4","text":"等待1帧","blockType":"command","arguments":{}},{"opcode":"block_cf6fe4bfa447a4e2","text":"-∞","blockType":"reporter","arguments":{}},{"opcode":"block_4a5d4d85974123c9","text":"返回null","blockType":"reporter","arguments":{}},{"opcode":"block_4809c00d2c0ebeb4","text":"无返回","blockType":"reporter","arguments":{}},{"opcode":"block_d131168e67fb1de8","text":"空白返回","blockType":"reporter","arguments":{}},{"opcode":"block_2b021c4cb5aa1ef3","text":"注释 [52f3d76b87500d34]","blockType":"command","arguments":{"52f3d76b87500d34":{"type":"string","defaultValue":"阿巴阿巴阿巴阿巴阿巴阿巴"}}},{"opcode":"block_b0a98f493d0b51b6","text":"返回NaN","blockType":"reporter","arguments":{}},{"opcode":"block_aaa174a639522555","text":"注释 [e4dfae81c21a2f9a]","blockType":"reporter","arguments":{"e4dfae81c21a2f9a":{"type":"string","defaultValue":"抖音名：柿子🍀（目标2w粉）等1846人"}}}]}
}
async block_86952433254774e5(args) {   return true;
 }
async block_b0514ebc8b7bc019(args) {   return false;
 }
async block_7c8573ff01713bcc(args) {   return (Math.random() > .5);
 }
async block_205857f743b7abc5(args) {   return Math.PI;
 }
async block_24d3b6524a597921(args) {   return Math.E;
 }
async block_4d2c2876122245d7(args) {   return (!ExtForge.Variables.get("布尔值")
  );
 }
async block_2d4868b7394df34f(args) {   return ((1) / (0));
 }
async block_35d11c36683c84f4(args) {   await new Promise(resolve => { requestAnimationFrame(() => { resolve() }) })
  if ((await extension.block_b0514ebc8b7bc019({  }))) {   await extension.block_35d11c36683c84f4({  });
   };
 }
async block_cf6fe4bfa447a4e2(args) {   return ((-1) / (0));
 }
async block_4a5d4d85974123c9(args) {   return ("null");
 }
async block_4809c00d2c0ebeb4(args) {  }
async block_d131168e67fb1de8(args) {   return ("");
 }
async block_2b021c4cb5aa1ef3(args) {  }
async block_b0a98f493d0b51b6(args) {   return ("NaN");
 }
async block_aaa174a639522555(args) {  }
}

let extension = new Extension();
// code compiled from CB-ExtGallary
(async () => {   eval(("alert(\"《不》欢迎你使用lpfcdn的没用工具箱\")"))
 })();

Scratch.extensions.register(extension);
})(Scratch);