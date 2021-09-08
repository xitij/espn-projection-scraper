const fs = require('fs');
const { promisify } = require('util');
const ManagerMappings = require('./mappings/sctid-managers');
const TeamMappings = require('./mappings/teams');

const appendFile = promisify(fs.appendFile);
const writeFile = promisify(fs.writeFile);

const LAST_PAGE_NUM = 11;

class DraftParser {
  constructor(filename, year) {
    this.filename = filename;
    this.year = year;
    this.players = {};
  }

  async createDraftCSV() {
    const picks = [];
    // read all the projections to get players
    for (let page = 1; page < LAST_PAGE_NUM; page += 1) {
      console.log(`parsing players page ${page}`);
      let projections = require(`./projections/${this.year}/projections-page-${page}.json`);
      projections.players.forEach((player) => {
        this.addPlayerObject(player);
      });
    }

    // read all the picks from the draft page
    console.log('parsing draft');
    let draftJSON = require(`./draft/${this.year}/values.json`);
    draftJSON.draftDetail.picks.forEach((pick) => {
      const parsedPlayer = this.createPickObject(pick);
      if (parsedPlayer) {
        picks.push(parsedPlayer);
      }
    });
    console.log(`parsed ${picks.length} picks`);
    try {
      // print the picks to the file in csv format
      await this.writePicksToFile(picks);
      console.log(`done writing file: ${this.filename}`);
    } catch (e) {
      console.error(`createDraftCSV - write file failed with error: ${e.message}`);
    }
  }

  addPlayerObject(rawData) {
    this.players[rawData.id] = {
      name: rawData.player.fullName,
      position: rawData.player.defaultPositionId,
      team: rawData.player.proTeamId,
    };
  }

  createPickObject(pick) {
    const playerId = pick.playerId;
    const player = this.players[playerId];
    if (!player) {
      console.log(`Unknown player id: ${playerId}`);
      return null;
    } else {
      const position = TeamMappings.positionMapping[player.position];
      const pickObject = {
        pick: pick.id,
        player: player.name,
        team: TeamMappings.teamAbbrevMapping[player.team],
        pos: position,
        cost: pick.bidAmount,
        owner: ManagerMappings.managers[pick.teamId],
      };
      return pickObject;
    }
  }

  async writePicksToFile(picks) {
    const fullFilename = `${__dirname}/${this.filename}`;

    // Write the title line
    await writeFile(fullFilename, this.getCSVLine());
    // Write each pick line
    for (const pick of picks) {
      const data = this.getCSVLine(pick);
      await appendFile(fullFilename, data);
    }
  }

  getCSVLine(player) {
    if (!player) {
      // This is the title line
      return 'Pick,Player,Team,Pos,Cost,Owner\n';
    }
    return `${Object.values(player).join(',')}\n`;
  }
}

module.exports = DraftParser;
