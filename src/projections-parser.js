const fs = require('fs');
const { promisify } = require('util');
const TeamMappings = require('./mappings/teams');
const StatMappings = require('./mappings/stats');

const appendFile = promisify(fs.appendFile);
const writeFile = promisify(fs.writeFile);

const LAST_PAGE_NUM = 11;
const SCTID_PROJECTION_ID = '102020';

class ProjectionsParser {
  constructor(filename, year) {
    this.filename = filename;
    this.year = year;
    this.posRanks = {
      QB: 1,
      RB: 1,
      WR: 1,
      TE: 1,
      'D/ST': 1,
      K: 1,
    };
  }

  async createProjectionsCSV() {
    const players = [];
    // read all the players from the projections page
    for (let page = 1; page < LAST_PAGE_NUM; page += 1) {
      console.log(`parsing projections page ${page}`);
      let projections = require(`./projections/${this.year}/projections-page-${page}.json`);
      projections.players.forEach((player, idx) => {
        // 1-50 for page 1, 51-100 page 2, etc
        const rank = (idx + 1) + ((page - 1) * 50);
        const parsedPlayer = this.createPlayerObject(player, rank);
        players.push(parsedPlayer);
      });
    }
    console.log(`parsed ${players.length} players`);
    try {
      // print the player info to the file in csv format
      await this.writePlayersToFile(players);
      console.log(`done writing file: ${this.filename}`);
    } catch (e) {
      console.error(`createCSV - write file failed with error: ${e.message}`);
    }
  }

  async createAuctionCSV() {
    const players = [];
    // read all the players from the projections page
    let projections = require(`./auction-values/auction-values-2020.json`);

    // sort the players by auction value, then points
    projections.players.sort((a, b) => {
      if (a.draftAuctionValue > b.draftAuctionValue) {
        return -1;
      } else if (b.draftAuctionValue > a.draftAuctionValue) {
        return 1;
      } else {
        const aProjected = a.player.stats.find(stat => stat.id === SCTID_PROJECTION_ID);
        const bProjected = b.player.stats.find(stat => stat.id === SCTID_PROJECTION_ID);
        const aTotalPoints = aProjected.appliedTotal;
        const bTotalPoints = bProjected.appliedTotal;
        if (aTotalPoints > bTotalPoints) {
          return -1;
        } else if (bTotalPoints > aTotalPoints) {
          return 1;
        }
        return 0;
      }
    });

    // parse the players
    projections.players.forEach((player, idx) => {
      const rank = idx + 1;
      const parsedPlayer = this.createPlayerObject(player, rank);
      players.push(parsedPlayer);
    });
    console.log(`parsed ${players.length} players`);
    try {
      // print the player info to the file in csv format
      await this.writePlayersToFile(players);
      console.log(`done writing file: ${this.filename}`);
    } catch (e) {
      console.error(`createCSV - write file failed with error: ${e.message}`);
    }
  }

  createPlayerObject(rawData, rank) {
    const position = TeamMappings.positionMapping[rawData.player.defaultPositionId];
    const posRank = this.posRanks[position];
    const auctionValue = rawData.draftAuctionValue < 1 ? 1 : rawData.draftAuctionValue;
    const playerObject = {
      rank: rank,
      player: rawData.player.fullName,
      team: TeamMappings.teamAbbrevMapping[rawData.player.proTeamId],
      pos: position,
      'pos-rank': posRank,
      'espn-auction': auctionValue,
    };
    // Increment the position rank
    this.posRanks[position]++;

    return playerObject;
  }

  async writePlayersToFile(players) {
    const fullFilename = `${__dirname}/${this.filename}`;

    // Write the title line
    await writeFile(fullFilename, this.getCSVLine());
    // Write each player line
    for (const player of players) {
      const data = this.getCSVLine(player);
      await appendFile(fullFilename, data);
    }
  }

  getCSVLine(player) {
    if (!player) {
      // This is the title line
      return 'Rank,Player,Team,Pos,Pos Rank, ESPN Auc $\n';
    }
    return `${Object.values(player).join(',')}\n`;
  }
}

module.exports = ProjectionsParser;
