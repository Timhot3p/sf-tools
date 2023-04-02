Site.ready({ type: 'simulator' }, function () {
    $('#sim-threads').captiveInputField('hydra_sim/threads', 4, v => !isNaN(v) && v >= 1);
    $('#sim-iterations').captiveInputField('hydra_sim/iterations', 10000, v => !isNaN(v) && v >= 1);
    
    const getAttributeList = function (attribute) {
        return {
            'Strength': ['Strength', 'Dexterity', 'Intelligence'],
            'Dexterity': ['Dexterity', 'Strength', 'Intelligence'],
            'Intelligence': ['Intelligence', 'Strength', 'Dexterity']
        }[attribute]
    }

    const ATTRIBUTE_MAP = CONFIG.classes().map((data) => getAttributeList(data.Attribute));

    const EditorController = new (class {
        constructor () {
            this.fields = {
                players: new Field('[data-path="PlayerCount"]', '', Field.isHydraPlayerCount),
                level: new Field('[data-path="Level"]', '', Field.isHydraPetLevel),
                str: new Field('[data-path="Main"]', '', Field.isNonZero),
                dex: new Field('[data-path="Side1"]', '', Field.isNonZero),
                int: new Field('[data-path="Side2"]', '', Field.isNonZero),
                con: new Field('[data-path="Constitution"]', '', Field.isNonZero),
                lck: new Field('[data-path="Luck"]', '', Field.isNonZero),
                hydra: new Field('[data-path="Hydra"]', '1')
            };

            this.fields['hydra'].$object.dropdown({
                preserveHTML: true,
                values: Object.entries(HYDRA_MAP).map(([id, { class: klass }]) => {
                    return {
                        name: `<img class="ui centered image !-ml-3 !mr-2" src="res/class${klass}.png"><span>${intl(`hydra.names.${id}`)}</span>`,
                        value: id
                    };
                })
            }).dropdown('set selected', '1');

            for (let field of Object.values(this.fields)) {
                field.setListener(() => clearResults());
            }
        }

        fill (object) {
            if (object) {
                for (var [key, field] of Object.entries(this.fields)) {
                    field.set(getObjectAt(object, field.path()));
                }
            } else {
                for (var [key, field] of Object.entries(this.fields)) {
                    field.clear();
                }
            }
        }

        read () {
            let object = {};
            for (var [key, field] of Object.entries(this.fields)) {
                setObjectAt(object, field.path(), field.get());
            }

            return object;
        }

        valid () {
            for (var [key, field] of Object.entries(this.fields)) {
                if (!field.valid()) {
                    return false;
                }
            }

            return true;
        }

        genEmpty () {
            let object = {};
            for (var [key, field] of Object.entries(this.fields)) {
                setObjectAt(object, field.path(), field.defaultValue);
            }

            return object;
        }
    })();

    function getHydraData () {
        let obj = HYDRA_MAP[EditorController.read().Hydra];

        return {
            Armor: obj.armor,
            Level: obj.level,
            Class: obj.class,
            Strength: {
                Total: obj.str
            },
            Dexterity: {
                Total: obj.dex
            },
            Intelligence: {
                Total: obj.int
            },
            Constitution: {
                Total: obj.con
            },
            Luck: {
                Total: obj.lck
            },
            Items: {
                Wpn1: {
                    DamageMin: obj.min,
                    DamageMax: obj.max
                }
            },
            Health: obj.health
        }
    }

    function getAtttributeFromMS(type, klass, data) {
        for (const [index, att] of Object.entries(['Main', 'Side1', 'Side2'])) {
            if (type === ATTRIBUTE_MAP[klass - 1][index]) {
                return data[att];
            }
        }
    }

    function getPlayerData (klass) {
        const data = EditorController.read();
        return {
            Level: data.Level,
            Class: klass,
            Armor: data.Level * CONFIG.fromIndex(klass).MaximumDamageReduction,
            Strength: {
                Total: getAtttributeFromMS('Strength', klass, data)
            },
            Dexterity: {
                Total: getAtttributeFromMS('Dexterity', klass, data)
            },
            Intelligence: {
                Total: getAtttributeFromMS('Intelligence', klass, data)
            },
            Constitution: {
                Total: data.Constitution
            },
            Luck: {
                Total: data.Luck
            },
            Attacks: data.PlayerCount
        }
    }

    function playersToData (players, hydra) {
        const sortedPlayers = _sort_des(players, p => _dig(p, ATTRIBUTE_MAP[p.Class - 1][0], 'Total'));
        const hydraPlayers = _slice_len(sortedPlayers, 0, 25);

        const data = {
            Hydra: hydra || EditorController.fields['hydra'].get(),
            PlayerCount: players.length,
            Level: Math.min(Math.trunc(_sum(hydraPlayers.map(p => p.Level)) / 25), 600)
        }

        for (const att of ['Constitution', 'Luck']) {
            data[att] = Math.ceil(_sum(hydraPlayers.map(p => _dig(p, att, 'Total'))) / 10);
        }

        for (const [index, att] of Object.entries(['Main', 'Side1', 'Side2'])) {
            data[att] = Math.ceil(_sum(hydraPlayers.map(p => _dig(p, ATTRIBUTE_MAP[p.Class - 1][index], 'Total'))) / 10);
        }

        return data;
    }

    $(document.body).on('paste', function (event) {
        if (event.target.type != 'text') {
            try {
                const players = JSON.parse(event.originalEvent.clipboardData.getData('text'));
                if (Array.isArray(players)) {
                    EditorController.fill(playersToData(players));
                }
            } catch (e) {
                // Do nothing
            }
        }
    });

    $('#sim-editor input').on('paste', function (event) { event.stopPropagation(); });

    StatisticsIntegration.configure({
        profile: HYDRA_PROFILE,
        type: 'guilds',
        scope: (dm) => _compact(Object.values(dm.Groups).map(g => g.List.map(([ts, gi]) => gi).filter(gi => gi.MembersTotal == gi.MembersPresent)[0])),
        callback: (group) => {
            EditorController.fill(
                playersToData(
                    _compact(group.Members.map(pid => DatabaseManager.getPlayer(pid, group.Timestamp))),
                    (group.Hydra || 0) + 1
                )
            );
        }
    });

    $('#simulate').click(function () {
        const instances = Math.max(1, Number($('#sim-threads').val()) || 4);
        const iterations = Math.max(1, Number($('#sim-iterations').val()) || 2500);

        if (EditorController.valid()) {
            const results = [];

            const hydra = getHydraData();
            const pets = [1, 2, 3].map(klass => getPlayerData(klass));

            const batch = new WorkerBatch('hydra');

            for (let i = 0; i < pets.length; i++) {
                batch.add(
                    ({ results: _results }) => {
                        results[i] = _results
                    },
                    {
                        iterations,
                        hydra,
                        pet: pets[i]
                    }
                )
            }

            batch.run(instances).then((duration) => {
                Toast.info(intl('simulator.toast.title'), intl('simulator.toast.message', { duration: _format_duration(duration) }));
                
                showResults(results);
            })
        }
    });

    function showResults (results) {
        let content = '';

        for (let i = 0; i < results.length; i++) {
            const { iterations, score, pet, hydra, avg_health, avg_fights } = results[i];

            let averageHealth = Math.trunc(100 * Math.max(0, avg_health / hydra.Health));
            let averageFights = Math.ceil(avg_fights);

            content += `
                <div style="flex: 1 1 32%; margin: 0.5em; ${score == 0 ? 'opacity: 60%' : ''}">
                    <h3 class="ui centered inverted header !mt-0">
                        <img class="ui centered image" style="width: 4em; margin-top: -1em; margin-bottom: -0.66em; margin-left: -0.66em;" src="res/class${pet.Class}.png">
                        <span>${(100 * score / iterations).toFixed(2)}%</span>
                    </h3>
                    <hr/>
                    <div class="px-1"><span style="font-size: 80%;">&Delta;</span> ${intl('hydra.result.health', { health: averageHealth })}</div>
                    <div class="px-1"><span style="font-size: 80%;">&Delta;</span> ${intl(`hydra.result.fights_${averageFights > 1 ? 'multiple': 'single'}`, { count: averageFights })}</div>
                </div>
            `;
        }

        $('#results').html(content);
    }

    function clearResults () {
        const $simButton = $('#simulate');
        if (EditorController.valid()) {
            $simButton.removeClass('disabled');
        } else {
            $simButton.addClass('disabled');
        }

        $('#results').html('');
    }

    clearResults();
});