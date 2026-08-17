// Godot Game Control Extension for Scratch
// This extension provides blocks for controlling Godot games
// It communicates with the Godot bridge server via HTTP

(function(Scratch) {
    "use strict";

    if (!Scratch.extensions.unsandboxed) {
        throw new Error("Godot extension must run unsandboxed");
    }

    var BRIDGE_URL = "http://" + location.host;

    function httpPost(url, data) {
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        }).then(function(r) { return r.json(); });
    }

    function httpGet(url) {
        return fetch(url).then(function(r) { return r.json(); });
    }

    // Track generated code blocks
    var codeBlocks = [];
    var gameState = { score: 0, lives: 3, level: 1 };

    function generateCode() {
        var lines = [];
        lines.push("# Auto-generated from Scratch Godot blocks");
        lines.push("extends Node2D");
        lines.push("");
        lines.push("func _ready():");
        lines.push("    pass");
        lines.push("");
        lines.push("func _process(delta):");
        for (var i = 0; i < codeBlocks.length; i++) {
            var cb = codeBlocks[i];
            if (cb.type === "move") {
                lines.push("    # Move action");
                lines.push("    if Input.is_action_pressed(\"ui_right\"):");
                lines.push("        position.x += " + cb.speed + " * delta");
                lines.push("    if Input.is_action_pressed(\"ui_left\"):");
                lines.push("        position.x -= " + cb.speed + " * delta");
                lines.push("    if Input.is_action_pressed(\"ui_up\"):");
                lines.push("        position.y -= " + cb.speed + " * delta");
                lines.push("    if Input.is_action_pressed(\"ui_down\"):");
                lines.push("        position.y += " + cb.speed + " * delta");
            } else if (cb.type === "jump") {
                lines.push("    # Jump action");
                lines.push("    if Input.is_action_just_pressed(\"ui_accept\"):");
                lines.push("        velocity.y = -" + cb.force);
                lines.push("    velocity.y += 980 * delta");
                lines.push("    move_and_slide()");
            } else if (cb.type === "score") {
                lines.push("    # Score tracking");
                lines.push("    gameState.score = " + gameState.score);
            }
        }
        if (codeBlocks.length === 0) {
            lines.push("    pass");
        }
        lines.push("");
        lines.push("func _on_body_entered(body):");
        lines.push("    if body.is_in_group(\"collectible\"):");
        lines.push("        gameState.score += 1");
        lines.push("        body.queue_free()");
        return lines.join("\n");
    }

    function sendToGodot() {
        var code = generateCode();
        return httpPost(BRIDGE_URL + "/api/save", {
            filename: "scratch_generated.gd",
            code: code
        });
    }

    class GodotGameControl {
        constructor(runtime) {
            this.runtime = runtime;
        }

        getInfo() {
            return {
                id: "godotGameControl",
                name: "Godot Game",
                color1: "#4a90d9",
                color2: "#357abd",
                color3: "#2a5f9e",
                blocks: [
                    {
                        opcode: "whenFlagClicked",
                        blockType: Scratch.BlockType.HAT,
                        text: "when game starts"
                    },
                    {
                        opcode: "whenKeyPressed",
                        blockType: Scratch.BlockType.HAT,
                        text: "when [KEY] key pressed",
                        arguments: {
                            KEY: {
                                type: Scratch.ArgumentType.STRING,
                                menu: "keys",
                                defaultValue: "space"
                            }
                        }
                    },
                    {
                        opcode: "movePlayer",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "move player at speed [SPEED]",
                        arguments: {
                            SPEED: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 200
                            }
                        }
                    },
                    {
                        opcode: "jumpPlayer",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "jump with force [FORCE]",
                        arguments: {
                            FORCE: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 500
                            }
                        }
                    },
                    {
                        opcode: "setScore",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set score to [SCORE]",
                        arguments: {
                            SCORE: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 0
                            }
                        }
                    },
                    {
                        opcode: "changeScore",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "change score by [AMOUNT]",
                        arguments: {
                            AMOUNT: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 1
                            }
                        }
                    },
                    {
                        opcode: "getScore",
                        blockType: Scratch.BlockType.REPORTER,
                        text: "score",
                        disableMonitor: false
                    },
                    {
                        opcode: "whenCollision",
                        blockType: Scratch.BlockType.HAT,
                        text: "when touching [OBJECT]",
                        arguments: {
                            OBJECT: {
                                type: Scratch.ArgumentType.STRING,
                                menu: "objects",
                                defaultValue: "enemy"
                            }
                        }
                    },
                    {
                        opcode: "sendToGodot",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "send code to Godot",
                        func: "sendToGodot"
                    },
                    {
                        opcode: "setPlayerSpeed",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "set player speed to [SPEED]",
                        arguments: {
                            SPEED: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 300
                            }
                        }
                    },
                    {
                        opcode: "destroy",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "destroy this object"
                    },
                    {
                        opcode: "createClone",
                        blockType: Scratch.BlockType.COMMAND,
                        text: "create clone of myself"
                    }
                ],
                menus: {
                    keys: {
                        acceptReporters: true,
                        items: ["space", "up arrow", "down arrow", "left arrow", "right arrow", "w", "a", "s", "d"]
                    },
                    objects: {
                        acceptReporters: true,
                        items: ["enemy", "collectible", "wall", "player"]
                    }
                }
            };
        }

        whenFlagClicked() {
            return this.runtime.startProfiler();
        }

        whenKeyPressed(args) {
            var key = args.KEY;
            codeBlocks.push({ type: "keypress", key: key });
            sendToGodot();
        }

        movePlayer(args) {
            var speed = Number(args.SPEED) || 200;
            codeBlocks.push({ type: "move", speed: speed });
            sendToGodot();
        }

        jumpPlayer(args) {
            var force = Number(args.FORCE) || 500;
            codeBlocks.push({ type: "jump", force: force });
            sendToGodot();
        }

        setScore(args) {
            gameState.score = Number(args.SCORE) || 0;
            codeBlocks.push({ type: "score" });
            sendToGodot();
        }

        changeScore(args) {
            gameState.score += Number(args.AMOUNT) || 1;
            sendToGodot();
        }

        getScore() {
            return gameState.score;
        }

        whenCollision(args) {
            // Hat block - triggered by Godot bridge
            return false;
        }

        sendToGodot() {
            return sendToGodot();
        }

        setPlayerSpeed(args) {
            // Update player speed in the next generated code
        }

        destroy() {
            return httpPost(BRIDGE_URL + "/api/generate", {
                blocks: { action: "destroy" },
                filename: "destroy_action.gd"
            });
        }

        createClone() {
            return httpPost(BRIDGE_URL + "/api/generate", {
                blocks: { action: "clone" },
                filename: "clone_action.gd"
            });
        }
    }

    Scratch.extensions.register(new GodotGameControl());
})(Scratch);