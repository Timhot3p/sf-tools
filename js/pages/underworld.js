Site.ready({ name: 'underworld', type: 'simulator' }, function (urlParams) {
    $('[data-op="report"]').click(() => Dialog.open(ReportDialog, 'underworld'))

    // Handle simulate button validation
    let $simulateButton = $('#simulate');
    function updateSimulateButton () {
        let underworldValid = underworldEditor.valid() && ['goblin', 'troll', 'keeper'].reduce((memo, name) => memo + underworldEditor.fields[name].get(), 0) > 0;
        let playersValid = playerList.length > 0;

        if (underworldValid && playersValid) {
            $simulateButton.removeClass('disabled');
        } else {
            $simulateButton.addClass('disabled');
        }
    }

    // Handle save button
    let $saveButton = $('#save-player');
    function updateSaveButton () {
        $saveButton.toggle(playerCurrentIndex != -1)
    }

    // List of players
    let playerList = [];
    let playerIndex = 0;

    // Tracks currently selected player
    let playerCurrentIndex = -1;
    updateSaveButton();

    // Editor configuration
    Editor.createPlayerEditor('#player-editor');
    Editor.createPasteTarget();

    const playerEditor = new Editor('#player-editor');

    const underworldEditor = new (class extends EditorBase {
        constructor (selector) {
            super({
                goblin: new Field(`${selector} [data-path="GoblinPit"]`, '0', Field.isUnderworldBuilding),
                goblin_upgrades: new Field(`${selector} [data-path="GoblinUpgrades"]`, '0', Field.isNumber),
                troll: new Field(`${selector} [data-path="TrollBlock"]`, '0', Field.isUnderworldBuilding),
                troll_upgrades: new Field(`${selector} [data-path="TrollUpgrades"]`, '0', Field.isNumber),
                keeper: new Field(`${selector} [data-path="Keeper"]`, '0', Field.isUnderworldBuilding),
                keeper_upgrades: new Field(`${selector} [data-path="KeeperUpgrades"]`, '0', Field.isNumber),
            })

            for (const field of this.fieldsArray) {
                field.setListener(() => this.onChangeLister());
                field.triggerAlways = true;
            }
        }

        onChangeLister () {
            updateSimulateButton();
        }
    })('#underworld-editor');

    // Reset editor content
    underworldEditor.valid();
    underworldEditor.onChangeLister();

    // Integration
    StatisticsIntegration.configure({
        profile: FIGHT_SIMULATOR_PROFILE,
        type: 'players',
        cheats: true,
        generator: function (dm, $list, callback) {
            for (let [prefix, players] of Object.entries(_groupBy(dm.getLatestPlayers(), p => p.Prefix))) {
                $list.append($(`
                    <div class="ui fluid basic left pointing scrolling dropdown small button inverted !text-center !mt-2">
                        <span class="">${prefix}</span>
                        <div class="menu" style="overflow-y: scroll; width: 20rem !important;">
                            <div class="ui left search icon inverted input">
                                <i class="search icon"></i>
                                <input type="text" name="search" placeholder="Search player...">
                            </div>
                            ${
                                players.sort((a, b) => b.Own - a.Own || b.Timestamp - a.Timestamp).map(player => {
                                    return `
                                        <div class="item" data-value="${player.LinkId}">
                                            <img class="ui centered image !-ml-3 !mr-2" src="${_classImageUrl(player.Class)}"><span>${ player.Level } - ${ player.Name }</span>
                                        </div>
                                    `;
                                }).join('')
                            }
                        </div>
                    </div>
                `).dropdown({
                    match: 'text',
                    fullTextSearch: true,
                    action: function (_, identifier) {
                        callback(dm.getPlayer(identifier).Latest);
                    }
                }));
            }
        },
        callback: (item) => {
            insertPlayer(item)
        }
    });

    function insertPlayer (player) {
        playerList.unshift({
            player: _merge(new PlayerModel(), preparePlayerData(player)),
            score: null,
            index: playerCurrentIndex = playerIndex++
        })

        playerEditor.clear();

        updatePlayerList();
    }

    DOM.input({
        element: DOM.byID('sim-threads'),
        key: 'underworld_sim/threads',
        def: 4,
        validator: (value)=> !isNaN(value) && value >= 1
    })

    DOM.input({
        element: DOM.byID('sim-iterations'),
        key: 'underworld_sim/iterations',
        def: 2500,
        validator: (value)=> !isNaN(value) && value >= 1
    })

    // Prevent paste inside inputs from trying to load data
    $('#player-editor input, #underworld-editor input').on('paste', function (event) {
        event.stopPropagation();
    });

    // Paste mode toggle button
    let pasteMode = false;
    DOM.toggle({
        element: DOM.byID('paste-mode'),
        callback: (active) => {
            pasteMode = active;
        }
    })

    // Shield mode toggle button
    let shieldMode = false;
    DOM.toggle({
        element: DOM.byID('shield-mode'),
        callback: (active) => {
            shieldMode = active;
        }
    })

    let gladiatorMode = false;
    DOM.toggle({
        element: DOM.byID('gladiator-mode'),
        key: 'underworld_sim/gladiator',
        callback: (active) => {
            gladiatorMode = active;
        }
    })

    function getSimulatorFlags () {
        return {
            Gladiator15: gladiatorMode
        };
    }

    SimulatorUtils.configure({
        params: urlParams,
        onCopy: () => {
            return playerList.map((p) => ModelUtils.toSimulatorData(p.player));
        },
        onInsert: (data) => {
            handlePaste(data);
        },
        onLog: (callback) => {
            executeSimulation(1, 50, callback);
        }
    });

    // Paste handler
    $(document.body).on('paste', function (event) {
        try {
            let pasteData = event.originalEvent.clipboardData.getData('text');
            let pasteJson = JSON.parse(pasteData);

            handlePaste(pasteJson);
        } catch (e) {
            console.info(e);
        }
    }).on('dragover dragenter', function (event) {
        event.preventDefault();
        event.stopPropagation();
    }).on('drop', async function (event) {
        // Handle drag & drop in case we want to paste data via preset file
        let contentType = _dig(event, 'originalEvent', 'dataTransfer', 'files', 0, 'type');
        if (contentType == 'text/plain' || contentType == '') {
            event.preventDefault();
            event.stopPropagation();

            try {
                let pasteData = await event.originalEvent.dataTransfer.files[0].text();
                let pasteJson = JSON.parse(pasteData);
                let pasteImpl = contentType == 'text/plain' ? pasteJson : PlayaResponse.importData(pasteJson).players;

                handlePaste(pasteImpl);
            } catch (e) {
                console.info(e);
            }
        }
    });

    // Paste handler
    function preparePlayerData (data) {
        let object = data.Class ? data : new PlayerModel(data);

        ItemModel.forceCorrectRune(object.Items.Wpn1);
        ItemModel.forceCorrectRune(object.Items.Wpn2);

        if (object.Class == WARRIOR && typeof object.BlockChance == 'undefined') {
            object.BlockChance = object.Items.Wpn2.DamageMin;
        }

        if (object.Class != ASSASSIN) {
            object.Items.Wpn2 = ItemModel.empty();
        }

        return object;
    }

    function handlePaste (data) {
        data = SimulatorUtils.handlePaste(data);

        if (Array.isArray(data)) {
            if (pasteMode == false) {
                playerList = [];
                playerIndex = 0;

                playerEditor.clear();

                playerCurrentIndex = -1;
                updateSaveButton();
            }

            for (let entry of data) {
                playerList.push({
                    player: _merge(new PlayerModel(), preparePlayerData(entry)),
                    score: null,
                    index: playerIndex++
                })
            }

            updatePlayerList();
        } else if (data.Class || data.save) {
            playerEditor.fill(preparePlayerData(data));
        }
    }

    $('#copy-all').click(function () {
        copyJSON(playerList.map(({ player }) => ModelUtils.toSimulatorData(player)));
    })

    // Add methods
    function addPlayer () {
        let player = playerEditor.read();
        if (player.Name == '') {
            player.Name = `Player ${playerList.length + 1}`;
        }

        playerList.unshift({
            player: player,
            score: null,
            index: playerIndex++
        })

        playerCurrentIndex = -1;
        updateSaveButton();

        playerEditor.clear();
    }

    $('#add-player').click(function () {
        if (playerEditor.valid()) {
            addPlayer();
            updatePlayerList();
        }
    })

    // Save methods
    $saveButton.click(function () {
        if (playerEditor.valid()) {
            if (playerCurrentIndex != -1) {
                let index = playerList.findIndex(entry => entry.index == playerCurrentIndex);
                if (index != -1) {
                    playerList[index].player = playerEditor.read();
                    playerList[index].score = null;
                }
            } else {
                addPlayer();
            }

            updatePlayerList();
        }
    })

    // Display methods
    function updatePlayerList (resetPlayerScore = false) {
        if  (resetPlayerScore) {
            for (let entry of playerList) {
                entry.score = null;
            }
        }

        updateSimulateButton();

        if (playerList.every(entry => typeof entry.score === 'number')) {
            _sortDesc(playerList, entry => entry.player.Level + 1000 * entry.score);
        }

        let content = ''
        for (let i = 0; i < playerList.length; i++) {
            let {player, index, score} = playerList[i];

            content += `
                <div class="row selectable ${ index == playerCurrentIndex ? 'selected' : 'nselected' } text-white" data-index="${ index }">
                    <div class="player-index">${ i + 1 }</div>
                    <div class="three wide text-center column">
                        <img class="ui medium centered image" style="width: 50px;" src="${_classImageUrl(player.Class)}">
                    </div>
                    <div class="two wide column">
                        <b>${ player.Level }</b>
                    </div>
                    <div class="six wide column">
                        <b>${ player.Name }</b>
                    </div>
                    <div class="four wide text-center column">
                        ${ typeof score === 'number' ? `${ score.toFixed(2) }%` : '' }
                    </div>
                    <div class="one wide text-center column">
                        <i class="trash right aligned alternate cursor-pointer !text-red:hover outline icon" data-trash="${ index }"></i>
                    </div>
                </div>
            `;
        }

        $('#sim-players').html(content);

        $('[data-index]').click(function () {
            playerCurrentIndex = parseInt(this.dataset.index);
            updateSaveButton();

            playerEditor.fill(playerList.find(entry => entry.index == playerCurrentIndex).player);

            updatePlayerList();
        })

        $('[data-trash]').click(function () {
            let index = parseInt(this.dataset.trash);
            if (index == playerCurrentIndex) {
                playerEditor.clear();

                playerCurrentIndex = -1;
                updateSaveButton();
            }

            let listIndex = playerList.findIndex(entry => entry.index == index);
            if (listIndex != -1) {
                playerList.splice(listIndex, 1);
            }

            updatePlayerList();
        });
    }

    function executeSimulation (instances, iterations, logCallback) {
        const underworldValid = underworldEditor.valid() && ['goblin', 'troll', 'keeper'].reduce((memo, name) => memo + underworldEditor.fields[name].get(), 0) > 0;
        const playersValid = playerList.length > 0;

        if (underworldValid && playersValid) {
            const results = [];
            const batch = new WorkerBatch('underworld');

            updatePlayerList(true);

            let logs = [];

            for (let i = 0; i < playerList.length; i++) {
                batch.add(
                    ({ results: _results, logs: _logs }) => {
                        results.push(_results);

                        if (logCallback) {
                            logs = logs.concat(_logs);
                        }
                    },
                    {
                        units: UnderworldUnits.fromEditor(underworldEditor.read(), shieldMode),
                        player: playerList[i],
                        iterations,
                        flags: getSimulatorFlags(),
                        config: SimulatorUtils.config,
                        log: !!logCallback
                    }
                );
            }

            batch.run(instances).then((duration) => {
                Toast.info(intl('simulator.toast.title'), intl('simulator.toast.message', { duration: _formatDuration(duration) }));

                playerList = results;
                
                updatePlayerList();

                if (logs.length > 0) {
                    logCallback({
                        fights: logs,
                        players: playerList.map(({ player }) => player),
                        config: SimulatorUtils.config
                    });
                }
            });
        }
    }

    $('#simulate').click(function () {
        const instances = Math.max(1, Number($('#sim-threads').val()) || 4);
        const iterations = Math.max(1, Number($('#sim-iterations').val()) || 2500);

        executeSimulation(instances, iterations);
    })
});