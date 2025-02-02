Site.ready({ name: 'raids', type: 'simulator', requires: ['translations_monsters', 'translations_general'] }, function (urlParams) {
  $('[data-op="report"]').click(() => Dialog.open(ReportDialog, 'raids'))

  SimulatorUtils.configure({
      params: urlParams,
      onLog: (callback) => {
          executeSimulation(1, 50, callback);
      }
  });
  
  function validateLists () {
      return playerList.length > 0;
  }

  // Handle simulate button validation
  let $simulateButton = $('#simulate');
  function updateSimulateButton () {
      if (validateLists()) {
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
  updatePlayerList();

  // Current raid
  const availableRaids = [
    ...Array.from({ length: 10 }, (_, index) => ({
        value: `hellevator_${index + 1}`,
        name: intl(`raids.raids.hellevator`, { number: index + 1 }) 
    })),
    ...Array.from({ length: 50 }, (_, index) => ({
        value: `raid_${index + 1}`,
        name: intl(`general.guild_raid_${index + 1}`)
    }))
  ]

  let raid = null
  $('#raid').dropdown({
    values: availableRaids,
    onChange: (value) => {
        raid = value
    }
  }).dropdown('set selected', availableRaids[0].value)

  // Editor configuration
  Editor.createPlayerEditor('#player-editor');
  Editor.createPasteTarget();

  const editor = new (class extends Editor {
    _bind () {
        super._bind();

        this.fields['snack'].show(true);
        this.fields['snack_potency'].show(true);
    }
  })('#player-editor');

  editor.clear();

  // Captive inputs
  DOM.input({
      element: DOM.byID('sim-threads'),
      key: 'guild_sim/threads',
      def: 4,
      validator: (value)=> !isNaN(value) && value >= 1
  })

  DOM.input({
      element: DOM.byID('sim-iterations'),
      key: 'guild_sim/iterations',
      def: 2500,
      validator: (value)=> !isNaN(value) && value >= 1
  })

  // Prevent paste inside inputs from trying to load data
  $('#player-editor input').on('paste', function (event) {
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

  // Gladiator mode toggle button
  let gladiatorMode = false;
  DOM.toggle({
      element: DOM.byID('gladiator-mode'),
      key: 'guild_sim/gladiator',
      callback: (active) => {
          gladiatorMode = active;
      }
  });

  function getSimulatorFlags () {
      return {
          Gladiator15: gladiatorMode
      };
  }

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

      return ModelUtils.toSimulatorData(object)
  }

  function handlePaste (data) {
      if (Array.isArray(data)) {
          if (pasteMode == false) {
              playerList = [];

              editor.clear();

              playerCurrentIndex = -1;
              updateSaveButton();
          }

          for (let entry of data) {
              playerList.push({
                  player: _merge(new PlayerModel(), preparePlayerData(entry)),
                  index: playerIndex++
              })
          }

          updatePlayerList();
      } else if (data.Class || data.save) {
          editor.fill(preparePlayerData(data));
      }
  }

  $('#copy-all').click(function () {
      copyJSON(playerList.map((p) => ModelUtils.toSimulatorData(p.player)));
  })

  // Add methods
  function addPlayer () {
      let player = editor.read();
      if (player.Name == '') {
          player.Name = `Player ${playerList.length + 1}`;
      }

      playerList.unshift({
          player: player,
          index: playerIndex++
      })

      playerCurrentIndex = -1;
      updateSaveButton();

      editor.clear();
  }

  $('#add-player').click(function () {
      if (editor.valid()) {
          addPlayer();
          updatePlayerList();
      }
  })

  // Save methods
  $saveButton.click(function () {
      if (editor.valid()) {
          if (playerCurrentIndex != -1) {
              let index = playerList.findIndex(entry => entry.index == playerCurrentIndex);
              if (index != -1) {
                  playerList[index].player = editor.read()
              }
          } else {
              addPlayer();
          }

          updatePlayerList();
      }
  })

  // Display methods
  function updatePlayerList () {
      updateSimulateButton();

      _sortDesc(playerList, entry => entry.player.Level);

      let content = ''
      for (let i = 0; i < playerList.length; i++) {
          let {player, index} = playerList[i];

          content += `
              <div class="text-white row selectable ${ index == playerCurrentIndex ? 'selected' : 'nselected' }" data-index="${ index }">
                  <div class="player-index">${ i + 1 }</div>
                  <div class="three wide text-center column">
                      <img class="ui medium centered image" style="width: 50px;" src="${_classImageUrl(player.Class)}">
                  </div>
                  <div class="two wide column">
                      <b>${ player.Level }</b>
                  </div>
                  <div class="ten wide column">
                      <b>${ player.Name }</b>
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

          editor.fill(playerList.find(entry => entry.index == playerCurrentIndex).player);

          updatePlayerList();
      })

      $('[data-trash]').click(function () {
          let index = parseInt(this.dataset.trash);
          if (index == playerCurrentIndex) {
              editor.clear();

              playerCurrentIndex = -1;
              updateSaveButton();
          }

          let listIndex = playerList.findIndex(entry => entry.index == index);
          if (listIndex != -1) {
              playerList.splice(listIndex, 1);
          }

          updatePlayerList();

          return false;
      });
  }

  function displayResults (results, iterations) {
      let score = 100 * _mappedSum(results, r => r.score) / iterations;

      $('div.row.results').html(`
          <div class="sixteen wide column" style="display: flex; flex-direction: row; align-items: center; justify-content: center;">
                <h3 class="ui centered inverted header" style="margin-top: 1em;">
                    <span>${ intl('raids.result', { chance: score.toFixed(2) }) }</span>
                </h3>
          </div>
      `).show();
  }

  $('#simulate').click(function () {
      const instances = Math.max(1, Number($('#sim-threads').val()) || 4);
      const iterations = Math.max(1, Number($('#sim-iterations').val()) || 2500);

      executeSimulation(instances, iterations);
  })

  StatisticsIntegration.configure({
    profile: HYDRA_PROFILE,
    type: 'guilds',
    scope: (dm) => _compact(Object.values(dm.Groups).map(g => g.List.filter(gi => gi.MembersTotal == gi.MembersPresent)[0])),
    callback: (group) => {
      editor.clear();
      playerCurrentIndex = -1;
      updateSaveButton();

      playerList = group.Members.map(memberId => {
          return {
              player: ModelUtils.toSimulatorData(DatabaseManager.getPlayer(memberId, group.Timestamp)),
              index: playerIndex++
          };
      })

      updatePlayerList();
    }
  });

  function generateEnemies () {
    if (raid.startsWith('hellevator_')) {
        const tier = parseInt(raid.slice(11))

        return Array.from({ length: 10 }).map((_, i) => {
            const monsterIndex = 10 * (tier - 1) + i

            const [ monsterClass, monsterRune ] = HELLEVATOR_RAID_DATA[monsterIndex]

            return MonsterGenerator.create(
                MonsterGenerator.MONSTER_RAID,
                18 + i * 10 + (tier - 1) * 100,
                monsterClass,
                monsterRune,
                25
            )
        }).map((player) => ({ player }))
    } else if (raid.startsWith('raid_')) {
        const raidData = RAID_DATA[raid]

        return Array.from({ length: Object.keys(raidData.floors).length }).map((_, i) => {
            const data = raidData.floors[i + 1]

            return {
                Armor: data.level * CONFIG.fromID(data.class).MaximumDamageReduction,
                Class: data.class,
                Name: `Monster ${i + 1}`,
                Level: data.level,
                Health: data.health,
                NoBaseDamage: true,
                NoGladiator: true,
                BlockChance: typeof data.block !== 'undefined' ? data.block : undefined,
                Identifier: 999,
                Strength: { Total: data.str },
                Dexterity: { Total: data.dex },
                Intelligence: { Total: data.int },
                Constitution: { Total: data.con },
                Luck: { Total: data.lck },
                Dungeons: { Player: 0, Group: 0 },
                Fortress: { Gladiator: 0 },
                Potions: { Life: 0 },
                Runes: {
                    Health: 0,
                    ResistanceFire: 0,
                    ResistanceCold: 0,
                    ResistanceLightning: 0,
                },
                Items: {
                    Hand: {},
                    Wpn1: {
                        AttributeTypes: { 2: 0 },
                        Attributes: { 2: 0 },
                        DamageMax: data.max,
                        DamageMin: data.min,
                        HasEnchantment: false
                    },
                    Wpn2: {
                        AttributeTypes: { 2: 0 },
                        Attributes: { 2: 0 },
                        DamageMax: data.max,
                        DamageMin: data.min,
                        HasEnchantment: false
                    }
                }
            };
        }).map((player) => ({ player }))
    } else {
        throw new Error('Not implemented')
    }
  }

  function executeSimulation (instances, iterations, logCallback) {
      if (validateLists()) {
          const results = [];
          let logs = [];

          const batch = new WorkerBatch('raids');

          const enemies = generateEnemies()

          for (let i = 0; i < instances; i++) {
              batch.add(
                  ({ results: _results, logs: _logs }, time) => {
                      results.push(_results);

                      Toast.info(intl('guilds.toast.end.title', { done: results.length, total: instances }), intl('guilds.toast.end.message#', { time: time / 1000 }))

                      if (logCallback) {
                          logs = logs.concat(_logs);
                      }
                  },
                  {
                      flags: getSimulatorFlags(),
                      players: playerList,
                      enemies,
                      iterations,
                      config: SimulatorUtils.config,
                      log: !!logCallback,
                  }
              )
          }

          batch.run(instances).then((duration) => {
              Toast.info(intl('simulator.toast.title'), intl('simulator.toast.message', { duration: _formatDuration(duration) }));

              displayResults(results, instances * iterations);

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
});