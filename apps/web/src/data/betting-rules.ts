export const bettingRulesData = [
  {
    "title": "Sports Betting Rules",
    "paragraphs": [
      "•\tIf the outcome of a market cannot be verified, we retain the option to delay bet settlement until official confirmation is published.",
      "•\tResults are based on the official result. Should the official result not be published, (Operator/Data.Bet) reserves the right to settle the bet with common sourced data at its choosing.",
      "•\tShould any market or price be published with incorrect information or pricing; we reserve the right to void affected bets",
      "•\tWe are not obliged to accept bets on selections with advertised prices or prices on third party sites that are a different price at the time the user wishes to place a bet. Only our live published prices are available for betting purposes.",
      "•\tShould any bet be taken where the outcomes are related to each other but not taken into account by the system or price; we reserve the right to void the bet.",
      "•\tWe reserve the right to void any bets made in a manner attempting to defraud (Operator/Data.Bet) or bets that were offered when the results of the outcome were already know.",
      "•\tWe reserve the right to suspend settlement of bets and players accounts where concerns of fraud or integrity within an event has occurred. If evidence within (Operator/Data.Bet) or our betting channels is noted, we reserve the right to void all affected bets and withhold payment to the account pending investigations with the relevant authority.",
      "•\tCustomers cannot cancel or change a bet once placed and confirmed.",
      "•\tBets that are deemed incorrectly settled are subject to resettlement within 48 hours. (Operator/Data.Bet) retains the right to reclaim incorrect payouts.",
      "•\tAll markets are for regular time only unless specifically stated within the market or specific sports rules.",
      "•\tIn the event a game is not played to the standard match format including but not exclusive to rules, points systems, length of game or format of a match; we reserve the right to void all bets on affected markets.",
      "•\tIf a match is not completed due to injury, disqualification, player withdrawals, etc. then we reserve the right to void all bets on open or unsettled markets.",
      "•\tIn the event competition name, team or participant names are incorrectly displayed or reversed from their home/away format, including at a neutral venue; we reserve the right to void all bets.",
      "•\tIn the event a match is abandoned or postponed. Bets will stand if the event is resumed and completed within 48 hours of the scheduled completion time. If the event has a change in competitors, players or teams. All open bets will be void.",
      "•\tIf event coverage is dropped, bets will be settled upon the announcement of the official result. Any market that cannot be verified will be made void.",
      "•\tIf an incorrect score or match information is offered resulting in a significant error in price of a selection, we reserve all rights to void bets on that selection, market or price. We also exercise the right to resettle at the correct price at our discretion.",
      "•\tOutright markets are settled for all listed selections, whether they take part in the event or not; with non-participating selections settled as a loss.",
      "•\tOutright selections where two or more places are tied, will be settled as a dead heat unless stated. In the event of a dead heat, the stake is split equally between the number of tied participants and calculated with the selection’s odds at the new stake. The remaining stake is settled as a loss.",
      "•\tAny and all onsite information relating to a game inclusive of scoreboards, stats, video streams etc.; is provided as a guide only. This information is subsequently delayed and can be incorrect. No onsite information should be used as a basis for bet placement. Settlement is not based on the information displayed. (Operator/Data.Bet) assumes no liability for the delay in any video transmission or data on-site.",
      "•\tBets will be settled in decimal odds regardless of the odds format selected.",
      "•\t(Operator/Data.Bet) reserves the right to make decisions on a bet-by-bet basis in circumstances not covered under the general sports betting rules, individual sports rules or terms and conditions.",
      "•\tSporting rules can be amended at anytime and notified online by publication to site. The sporting rules can be translated into numerous languages but the English version remains the official rules."
    ]
  },
  {
    "title": "Bet Builder Settlement Rules",
    "paragraphs": [
      "1. Single BetBuilder",
      "Definition:",
      "A BetBuilder is a single bet that combines multiple selections (legs) from the same event (e.g., \"Player A to score + over 2.5 goals in the match\").",
      "Settlement Logic:"
    ]
  },
  {
    "title": "All legs win",
    "paragraphs": [
      "✅ BetBuilder wins – full payout."
    ]
  },
  {
    "title": "Any leg loses",
    "paragraphs": [
      "❌ BetBuilder loses – entire bet is settled as lost."
    ]
  },
  {
    "title": "Any leg is void (e.g., player doesn’t play)",
    "paragraphs": [
      "⚠️ Whole BetBuilder is void – stake is refunded.",
      "Key Rule:",
      "•\tIf one leg is void, even if others win, lose, or tie, the entire BetBuilder is void.",
      "2. BetBuilder Combined with Other Selections (i.e., part of a multiple)",
      "Definition:",
      "A BetBuilder is one leg in a multiple (accumulator) that includes other unrelated selections from different matches or markets.",
      "Settlement Logic:"
    ]
  },
  {
    "title": "BetBuilder wins + other legs win",
    "paragraphs": [
      "✅ Full multiple wins – full payout."
    ]
  },
  {
    "title": "BetBuilder wins + any other leg loses",
    "paragraphs": [
      "❌ Multiple loses."
    ]
  },
  {
    "title": "BetBuilder is voided (due to a void leg) + other legs win",
    "paragraphs": [
      "⚠️ BetBuilder leg is voided → multiple is settled based on remaining selections."
    ]
  },
  {
    "title": "BetBuilder is voided + any other leg loses",
    "paragraphs": [
      "❌ Bet loses (loss from remaining leg).",
      "Key Rule:",
      "•\tIf a leg within the BetBuilder is void, the entire BetBuilder is void, and the multiple continues with reduced odds (or becomes a single if only one leg remains).",
      "3. Multiple BetBuilders (i.e., multiple BetBuilders in a single accumulator)",
      "Definition:",
      "An accumulator consisting of multiple separate BetBuilders from different matches.",
      "Settlement Logic:"
    ]
  },
  {
    "title": "All BetBuilders win",
    "paragraphs": [
      "✅ Full multiple wins."
    ]
  },
  {
    "title": "Any BetBuilder loses",
    "paragraphs": [
      "❌ Entire multiple loses."
    ]
  },
  {
    "title": "One or more BetBuilders are voided (due to voided leg inside)",
    "paragraphs": [
      "⚠️ Those BetBuilders are void → accumulator recalculated based on remaining valid BetBuilders.",
      "Key Rule:",
      "•\tEach BetBuilder is treated as a leg.",
      "•\tIf a leg within a BetBuilder is voided → that BetBuilder is void, but the rest of the multiple still stands."
    ]
  },
  {
    "title": "Alpine Skiing",
    "paragraphs": [
      "•\tEvents will be settled based on the result provided by the official governing body.",
      "•\tOutright Selections are deemed as runners regardless of whether the selection does not take part in the event. If a competitor does not take part, they will be settled as a loser.",
      "•\tIf a competitor is disqualified during the event, then they will be settled as a loser.",
      "•\tIn the case of an event being abandoned and no official winner is declared; the event will be declared void.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Event - Winner: Competitor declared the winner at the end of a single day event or multiday tournament dependent on the specified event."
    ]
  },
  {
    "title": "American Football",
    "paragraphs": [
      "•\tAll markets are settled on the official result at the end of the scheduled regular time play unless otherwise stated. Overtime will not count unless specified in the market. Should a result for a market not be available, it will be made void after 48 hours.",
      "•\tSettlement result will be the published result from the official governing body wherever possible.",
      "•\tIn an event that is postponed or abandoned, all bets are void if the event is not resumed within the current scheduled week of fixtures that it was scheduled to be played, unless an official winner is declared.",
      "•\tAll bets will be void should the event take place at a venue other than originally advertised, or in the event the home and away team are reversed.",
      "•\tFor bets to be paid out, a minimum of 55 minutes of a 60-minute match must be completed for markets to be settled. Only markets with a known result will be settled if less than this time is played in a match.",
      "•\tPlayer specific markets will be settled on the official statistics. If a player does not play in a game, the bet will be void. Overtime counts for all player prop markets in a game.",
      "•\tFor Other Outright Markets, all bets will be settled on the team or player that wins the overall event or award, unless otherwise specified in the market (for example; Regular Season Winner).",
      "•\tAny yardage or downs gained after penalties are applied will not apply for settlement purposes on play by play or rapid markets. Should any play not occur, the subsequent play will be used for settlement purposes unless a drive ends before reaching the next play; in which case bets will be made void.",
      "•\tAll markets that end before a specified play number is reached in a drive will be void if not reached. This includes punts and field goals.",
      "•\tField goal yardage, punt yardage or punt return yardage is not considered under the total yards gained in a play settlement.",
      "•\tA touchdown is credited as a first down only when the offence scores a touchdown.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner / Moneyline (Match/Half/Quarter): The team which officially wins the match or specified period. In the event of a tie after overtime all bets will be voided unless the draw is a given option.",
      "Total (Match/Half/Quarter): The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap / Spread (Match/Half/Quarter): Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score.",
      "Winner / Moneyline 3-Way (Match/Half/Quarter): The official winner in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Total 3-Way (Match/Half/Quarter):  The total number of points scored in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Home/Away Total (Match/Half/Quarter): The number of points scored in the match or specified period by a specific team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Double Chance (Match/Half/Quarter): Settled as the official result of the match or specified period being included in the selection, where two of the three possible selections will be winners and one selection will be a loser.",
      "Winning Margin (Match/Half/Quarter):  The specified margin (number of points) by which a team wins the match or specified period.",
      "Halftime/Fulltime: Settled on the official winner of the first half of the game and the full-time result.",
      "Will There Be Overtime: Settled on whether the game ends in a tied score. If a tied score is the official result and no overtime is played, the market will still be settled as a winner.",
      "Race to X Points (Match/Half/Quarter): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Total Touchdowns (Match/Half/Quarter): Determined by the total touchdowns scored in the match or specified period being above or below the taken line.",
      "Odd/Even (Match/Half/Quarter):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Highest Scoring Half / Quarter: Determined by the highest scoring half or quarter dependent on the selected market. Bets settled on official result. In the event of a tie, dead heat results will apply.",
      "NFL - Championship – Winner: Settled as the team who wins the NFL Superbowl.",
      "NFL – American Football Conference (AFC) – Winner: Settled as the representative team from the AFC in the NFL Superbowl.",
      "NFL – National Football Conference (NFC) – Winner: Settled as the representative team from the NFC in the NFL Superbowl.",
      "NFL – Winning Conference: Settled as the conference which provides the team who win the NFL Superbowl",
      "NFL – Winning Division: Settled as the division which provides the team who win the NFL Superbowl.",
      "NFL – Division – Winner: Settled as the team who wins the named division at the end of the regular season.",
      "Team – Regular Season Wins: Determined by the total number of wins the given team has at the end of the regular season, being under or over the given total of wins.",
      "Will They Make the Playoffs – Team: Determined by whether the quoted team advance into the playoffs at the end of the regular season.",
      "Event – Winner: Predict which team will win the named event."
    ]
  },
  {
    "title": "Athletics",
    "paragraphs": [
      "•\tEvents will be settled based on the result provided by the official governing body.",
      "•\tOutright Selections are deemed as runners regardless of whether the selection does not take part in the event. If a competitor does not take part, they will be settled as a loser.",
      "•\tIf a competitor is disqualified during the event, then they will be settled as a loser.",
      "•\tIn the case of an event being abandoned and no official winner is declared; the event will be declared void.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Australian Rules Football (Aussie Rules)",
    "paragraphs": [
      "•\tAll markets are settled on the official result at the end of the scheduled 80 minutes play unless otherwise stated. This includes any added injury or stoppage time but does not include extra-time.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tFirst Half markets refer to Quarters 1 & 2, Second Half refer to Quarters 3 & 4. Market outcome for half/quarter specific markets is determined based on the score in the respective period. This excludes points scored in other periods both in regular time and extra-time unless stated.",
      "•\t‘AFL Finals series’ is defined as the matches played after the conclusion of the regular season up to and including the Grand Final.",
      "•\tDead-heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Half/Quarter): The team which officially wins the match or specified period. In the event of a tie after regular time all bets will be voided unless the draw is a given option.",
      "1x2 (Match/Half/Quarter):  The team that officially win the specified period",
      "Total (Match/Half/Quarter):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Home/Away Total (Match/Half/Quarter): The number of points scored in the match or specified period by a specific team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Point Range (Match/Half/Quarter):  A grouped range of points that the winner of the match or specified period wins by.",
      "Handicap Betting (Match/Half/Quarter):  Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score.",
      "Winning Margin (Match/Half/Quarter):  The specified margin (number of points) by which a team wins the match or specified period.",
      "Odd/Even (Match/Half/Quarter):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Grand Final – Winner: The official classified winner of the AFL Grand Final.",
      "Grand Final – State of Winner: Settled as the state of origin of the winning team of the AFL Grand Final.",
      "Finals Series – Most Goals: Settled on the player who scores the most goals during the AFL Finals series (Dead heat rules apply).",
      "Finals Series – Most Disposals: Settled on the player who makes the most disposals during the AFL Finals series (Dead heat rules apply).",
      "Player awards outrights: Typically awards given to a specific player awarded at the end of the season and settled on the official outcome in accordance to the governing body."
    ]
  },
  {
    "title": "Badminton",
    "paragraphs": [
      "•\tEvents will be settled based on the result provided by the official governing body. In the event game coverage is lost and no result is published, all undecided markets are considered void.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tIf markets remain open with an incorrect score leading to a significant impact on prices, we reserve the right to void bets.",
      "•\tIn the event a player/team retires, all undecided markets are considered void.",
      "•\tOfficial points deductions will be taken into account for all undetermined markets. Markets which have already been determined will not take deductions into account."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Game): The team which officially wins the match or specified period. In the event of a tie after regular time all bets will be voided unless the draw is a given option",
      "Total Points (Match/Game):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Point Handicap (Match/Game):   Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score.",
      "Correct Score (Match/Game):  Settled on the correct prediction of the final score in the specified period.",
      "Odd/Even (Match/Game):    Determined by the total points scored in the match or specified period being either odd or even."
    ]
  },
  {
    "title": "Baseball",
    "paragraphs": [
      "•\tFor MLB matches, unless a starting pitcher is listed in the market; all bets will stand in the event of a change to either starting pitcher.",
      "•\tShould an event be interrupted, all remaining unsettled markets excluding the moneyline / match winner are considered void if the game does not resume within 12 hours and after 5 full innings of play from the start of the game.",
      "•\tIf a match is postponed or cancelled, then bets will still stand providing the original fixture starts within 24 hours of the original start time and a minimum of 7 innings has been played. If the event does not start re-start within 24 hours, all bets will be void.",
      "•\tAll bets will be void should the event take place at a venue other than originally advertised.",
      "•\tFirst half period bets are settled on the results of the first 5 innings",
      "•\tFor Other Outright Markets, all bets will be settled on the team or player that wins the overall event or award, unless otherwise specified in the market (for example; Regular Season Winner)."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner / Moneyline (Match/Innings): Determined by which team officially wins the match or specified period. In the event of a tie after regular time all bets will be voided unless the draw is a given option.",
      "Total (Match/Innings):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap / Spread (Match/Innings):  Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score.",
      "Winner / Moneyline 3-Way (Match/Innings):  The official winner in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Total 3-Way (Match/Innings):  The total number of points scored in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Home/Away Total (Match/Innings): The number of points scored in the match or specified period by a specific team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Odd/Even (Match/Innings):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Winning Margin (Match/Innings):  The specified margin (number of points) by which a team wins the match or specified period.",
      "Total Hits: The total number of hits scored in the specified period. Bets are settled on the total number of hits in the specified period being under or over the quoted line.",
      "Home/Away Total Hits: The total number of hits scored in the specified period. Bets are settled on either the Home, Tie or Away team who score the most hits in the given period.",
      "Extra Inning: Determined on whether the game goes into extra innings period. Settled on the official result.",
      "MLB - World Series – Winner: Settled as the team who wins the World Series Finals.",
      "MLB – National League – Winner: Settled as the representative team from the National League in the World Series",
      "MLB – American League – Winner: Settled as the representative team from the American League in the World Series",
      "MLB – Winning League: Settled as the league which provides the team who win the World Series Finals",
      "MLB – Winning Division: Settled as the division which provides the team who win the World Series Finals",
      "MLB – Division – Winner: Settled as the team who wins the named division at the end of the regular season.",
      "Player awards outrights: Typically awards given to a specific player awarded at the end of the season and settled on the official outcome in accordance to the governing body."
    ]
  },
  {
    "title": "Basketball",
    "paragraphs": [
      "All markets are settled on the official result at the end of the scheduled regular time play unless otherwise stated. Overtime will not count unless specified in the market. Should a result for a market not be available, it will be made void after 48 hours.",
      "•\tSettlement result will be the published result from the official governing body wherever possible.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tAll bets will be valid should the event take place at a venue other than originally advertised, unless the home and away team are reversed.",
      "•\tIn the event of a two-legged match and the aggregated scores are tied at the end of the 2nd leg match but not tied in the actual match; bets will be settled on the end of regular play result of the 2nd leg, excluding overtime.",
      "•\tFor bets to be paid out, a minimum of 35 minutes of a 40-minute match, or 40 minutes of a 48-minute match must be completed for markets to be settled. Only markets with a known result will be settled if less than this time is played in a match.",
      "•\tPlayer specific markets will be settled on the official statistics. If a player does not play in a game, the bet will be void. Overtime counts for all player prop markets in a game.",
      "•\tFor Other Outright Markets, all bets will be settled on the team or player that wins the overall event or award, unless otherwise specified in the market (for example; Regular Season Winner)."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner / Moneyline (Match/Half/Quarter): The team which officially wins the match or specified period. In the event of a tie after regular time all bets will be voided unless the draw is a given option.",
      "Total (Match/Half/Quarter):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap / Spread (Match/Half/Quarter):  Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score.",
      "Winner / Moneyline 3-Way (Match/Half/Quarter): The official winner in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Total 3-Way (Match/Half/Quarter):  The total number of points scored in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most points.",
      "Home/Away Total (Match/Half/Quarter): The number of points scored in the match or specified period by a specific team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Winning Margin (Match/Half/Quarter):  The specified margin (number of points) by which a team wins the match or specified period.",
      "Halftime/Fulltime: Settled on the official winner of the first half of the game and the full time result.",
      "Will There Be Overtime: Settled on whether the game ends in a tied score. If a tied score is the official result and no overtime is played, the market will still be settled as a winner.",
      "Race to X Points (Match/Half/Quarter): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Odd/Even (Match/Half/Quarter):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Highest Scoring Half / Quarter: Determined by the highest scoring half or quarter dependent on the selected market. Bets settled on official result. In the event of a tie, dead heat results will apply.",
      "2/3-Pointers Scored (Team/Total/Handicap):  Markets settled according to the total amount of 2 or 3 pointers officially scored in the specified period. Team markets are settled on the team scoring more than or less than the quoted line. Totals are settled on the combined number of 2 or 3 points scored in the given period; whilst handicap markets are settled once the given handicap has been applied to the official result. Overtime counts for all markets.",
      "NBA - Championship – Winner: Settled as the team who wins the NBA Playoff Finals.",
      "NBA - Eastern Conference – Winner: Settled as the representative team from the Eastern Conference in the NBA Playoff Finals.",
      "NBA – Western Conference – Winner: Settled as the representative team from the Western Conference in the NBA Playoff Finals.",
      "NBA – Winning Conference: Settled as the conference which provides the team who win the NBA playoff finals.",
      "NBA – Winning Division: Settled as the division which provides the team who win the NBA playoff finals.",
      "NBA – Division – Winner: Settled as the team who wins the named division at the end of the regular season.",
      "Team – Regular Season Wins: Determined by the total number of wins the given team has at the end of the regular season, being under or over the given total of wins.",
      "Will They Make the Playoffs – Team: Determined by whether the quoted team advance into the playoffs at the end of the regular season."
    ]
  },
  {
    "title": "Basketball 3x3",
    "paragraphs": [
      "•\tAll markets are settled on the result at the end of regular time. All markets include overtime if it is played, excluding the 1x2 market.",
      "•\tIn the event overtime is not played and scores are level, any bets where the draw is not offered will be made void."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: The team which officially wins the match. In the event of a tie after overtime, all bets will be voided unless the draw is a given option.",
      "1x2:  The team that officially win the match. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total:  The total number of points scored in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting:  Determined by which team will win the match once the specified handicap is applied to the overall match result.",
      "Home/Away Total: The number of points scored in the match by a specific team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Odd/Even: Determined by the total points scored in the match being either odd or even."
    ]
  },
  {
    "title": "Beach Soccer",
    "paragraphs": [
      "•\tAll markets are settled on the result at the end of regular time only unless otherwise stated.",
      "•\tExtra Time and/or Penalty shoot-outs are not considered unless otherwise stated.",
      "•\tA minimum of 30 minutes must be played for a game to be valid. All unsettled markets will be made void.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: The team which officially wins the match. In the event of a tie after overtime, all bets will be voided unless the draw is a given option.",
      "1x2:  The team that officially win the match. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total:  The total number of points scored in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting:  Determined by which team will win the match once the specified handicap is applied to the overall match result.",
      "Home/Away Total: The number of points scored in the match by a specific team. Bets settlement is determined on whether the result will be over or under the line taken",
      "Draw no Bet: Determined by the winner of the game in regular time. If the game ends in a tie, bets are void."
    ]
  },
  {
    "title": "Beach Volleyball",
    "paragraphs": [
      "All markets are settled on the official result at the end of the scheduled regular time play unless otherwise stated.",
      "•\tA Golden Set is not considered in any of the quoted markets unless stated.",
      "•\tAll games are scheduled to play regular format game rules. Should a different format be played such as number of sets, we reserve the right to void all affected bets.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tIf a team refuses to play or is disqualified for any reason or a match does not complete 1 full set of play, all bets will be void if not already determined regardless of reason.",
      "•\tOfficial point deductions will be taken into account for all undetermined markets. Markets which have already been determined will not take deductions into account."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Set): The team which officially wins the match or specified period. In the event of a tie after regular time a golden set will be used as a decider, unless a draw option is given.",
      "Total Points (Match/Set):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Set Handicap Determined by which team will win the match once the specified handicap is applied to the final set score.",
      "Total Sets Determined by the number of sets played in the game.",
      "Correct Score (Match/Set):  Settled on the correct prediction of the final score in the specified period.",
      "Race to X Points (Match/Set): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Odd/Even (Match/Set):  Determined by the total points scored in the match or specified period being either odd or even."
    ]
  },
  {
    "title": "Biathlon",
    "paragraphs": [
      "•\tEvents will be settled based on the result provided by the official governing body.",
      "•\tIf a competitor is disqualified during the event, then they will be settled as a loser.",
      "•\tIn the case of an event being abandoned and no official winner is declared; the event will be declared void.",
      "•\tOutright Selections are deemed as runners regardless of whether the selection does not take part in the event. If a competitor does not take part, they will be settled as a loser.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Event - Winner: Competitor declared the winner at the end of a single day event or multiday tournament dependent on the specified event.",
      "Tournament - Season H2H: Settled by the highest place competitor within the stated tournament between the two listed competitors within the market.   Boxing",
      "•\tThe start of the fight is determined by the bell signal at the beginning of the first round. In cases where a fighter cannot continue the match after the bell signal at the start of the next round, the fight is considered ended in the previous round",
      "•\tIn a fight that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the bout excluding the Olympic games, where bets will stand if fought before the end of the Olympic games closing ceremony.",
      "•\tIf for any reason the selected number of rounds on which we're betting is changed, all bets on the event will be made void other than the declared fight winner.",
      "•\tShould there be a withdrawal or a substitution of one of the fighters concerned, bets will be void.",
      "•\tIn the event of a no contest. All unsettled bets will be made void.",
      "•\tEvents are settled on the scorecards and results announced immediately after the end of the fight. Further appeals or amendments are not taken into account for settlement purposes.",
      "•\tIn the event a clear result, decision or method of victory cannot be established within 48 hours, all bets will be made void.",
      "•\tOutright Selections are deemed as runners regardless of whether the fighter fails to fight once they have begun the tournament. If a fighter defaults on a match, they will be settled as a loser.",
      "•\tA knockdown is recorded anytime the referee begins a countdown regardless of whether the fighter continues or not.",
      "•\tA draw or technical draw (Otherwise known as a no-contest) is defined as either a tied score on the scorecards or where the referee will stop the fight before the start of the 5th round for any reason other than a knockout, technical knockout or disqualification.",
      "•\tA knockout is awarded when an opposing boxer is knocked down and does not resume the fight within the 10-count given by the referee. A technical knockout is either awarded if a fighter is knocked down 3 times within 1 round; the referee steps in to stop the fight, or the fighter or his corner decide not to continue during the fight and the fight does not go to the judge’s scorecards or becomes a no-contest.",
      "•\tA decision is when a fighter is awarded victory by method of the judges scorecards at the end of the scheduled rounds. A technical decision is when a fighter is awarded victory by the method of the judges scorecards before the end of the scheduled rounds.",
      "•\tA fight will be considered not to have gone the distance if all scheduled completed rounds are not completed. This includes a no-contest, technical decision, knock out or technical knockout.",
      "•\tUnder/Over round betting markets will be settled on the following timeframes. 3-minute rounds will be settled as under (up to or including 1 minute 29 seconds) or over (1 minute 30 seconds onwards) of a count-out or stoppage. 2-minute rounds will be as under (up to and including 59 seconds) and over (1 minute onwards)",
      "•\tIn the event of collusion by either bettors or the fighter, we reserve the right to withhold settlement and void bets.",
      "•\tA knockdown is counted when a boxer is deemed to have been forced to the canvas through a punch. This must be followed by a standing count or a knockout being awarded to be classed as a knockdown",
      "•\tIf the official number of rounds to be fought is changed (and increased) from early market offering; then all bets on round markets will be made void."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: Determined by which fighter officially wins the match. In the event of a draw, bets will be made void",
      "1x2:  The fighter that officially win the match. Settled either as the named Red corner boxer, draw or named Blue corner boxer.",
      "Total Rounds: The total number of rounds fought in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Winner & Exact Rounds: The winner of the fight, along with the exact round in which the fight will end.",
      "Winning Method: Settled as the official method the fight was won or draw stated on the scorecards.",
      "Will the Fight Go The Distance: Determined by whether the fight ends before the completion of all scheduled rounds.",
      "To Be Knocked Down: Settled on whether the named boxer is knocked down to the canvas during the fight.",
      "To Be Knocked Down and Win: Settled on the named boxer to be knocked down and win the fight.",
      "Will both fighters be knocked down: Settled on whether both boxers in the fight are knocked down.",
      "Total knockdowns: Settled on the total number of official knockdowns being under or over the given line.",
      "Knockdown in Round «X»: Settled on a knockdown in the specified round."
    ]
  },
  {
    "title": "Chess",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tThe results of the game are determined by the sum of the number of games played within a match. In the event of a draw, bets will be made void.",
      "•\tIn the event of a postponed match; all bets will remain valid until the end of the tournament is concluded or an official winner is declared in the match.",
      "•\tIf a player fails to start the game, all bets will be made void.",
      "•\tIn the event of collusion by either bettors or the players, we reserve the right to withhold settlement and void bets."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "•\tWinner: Settled as the player whom officially wins the match. In the event of a draw all bets will be void unless a draw option is offered."
    ]
  },
  {
    "title": "Cricket",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tSuper Overs, or any other form of tie-break method to determine a winner after the end of the standard period of play, will not count for settlement purposes for any other market than the winner, where a draw is not offered.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 24 hours of the scheduled end of the match, unless an official winner is declared or the scheduled time of play exceeds a 48 hour period, for example a test match.",
      "•\tThe use of Duckworth-Lewis to calculate the target score for a match remains valid in verifying the official result.",
      "•\tA match is deemed to have started once the first ball has been bowled."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: Settled as the team who officially wins the match. In the event of a draw all bets will be void unless a draw option is offered.",
      "Event – Winner: The official classified winner of an event (Dead heat rules apply).",
      "Series – Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Curling",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time including extra ends (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared or is in an Olympic competition wherein will be void upon the closing ceremony.",
      "•\tA minimum of 5 ends must be completed for bets to be considered valid."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: The team which officially wins the match. In the event of a tie after regular time, bets will be settled as the winner including extra ends where played (when stated in the market name). Bets void if a tie is the final result.",
      "Total: The total number of points scored in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting: Determined by which team will win the match once the specified handicap is applied to the result of the match or named period."
    ]
  },
  {
    "title": "Cycling",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body. Any events shortened by the event organizer or due to weather will be settled according to the results published.",
      "•\tIf a race or stage is officially cancelled, all bets will be made void.",
      "•\tShould a result be appealed or altered after the initial race result is officially declared, it will be disregarded for bet settlement purposes.",
      "•\tOutright competitors or stage competitors are deemed as runners regardless of whether the selection does not take part in the event. If a competitor takes part in the event, they will be settled as a loser. If a competitor withdraws before an event, all bets on that selection will be made void.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: The rider who is officially declared the stage or event winner.",
      "Head2Head: Settled by the highest placed rider within the stated tournament or stage between the two listed competitors within the market. Should one rider be disqualified, bets on that selection will be settled as a loser. Should both riders withdraw or be disqualified at the same time, all bets will be void.",
      "Stage Winner: The official classified winner of a stage (Dead heat rules apply). Any disqualified riders shall be settled as a loser.",
      "Event – Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Darts",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tShould a match not be finished, or a replacement player be involved in the scheduled fixture, all unsettled bets will be void.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tFor the purposes of markets involving colour; a Bullseye will count as red for settlement purposes."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Set/Leg): The player/team who officially wins the match or specified period. In the event of a tie, all bets will be voided unless the draw is a given option.",
      "1x2:  The player/team that officially win the match. Settled on the result of regular time only, with either the home, draw or away selection being declared the winner.",
      "Total Sets: Settled as the total number of sets in the match will be over or under the specified line.",
      "Total Legs (Match/Leg): Settled as the total number of legs in the match or set will be over or under the specified line.",
      "Set Handicap: Determined by which player/team will win the match once the specified handicap is applied to the overall set score.",
      "Leg Handicap (Match/Leg): Determined by which player/team will win the match or set once the specified handicap is applied to the overall leg score for the respective market.",
      "Total 180s: Settled on the total number of 180s scored in the match being over or under the specified line.",
      "1st Player to Score a 180: Settled as the first player who will score the 1st 180 of the match.",
      "Most 180s: Settled as the player/team who will score the most 180s in the match.",
      "180s Handicap: Determined by which player/team will score the most 180s in the match once the specified handicap is applied to the overall match 180s score.",
      "Home/Away Total 180s: Determined by the total number of 180s thrown by the named player / team will be over or under the specified line.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Field Hockey",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tA minimum of 60 minutes (in a 70 minute game) or 50 minutes (in a 60 minute game) must be played for results to be valid."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Half/Extra Time/Penalties): The team which officially wins the match or specified period. In the event of a tie after regular time all bets will be voided unless the draw is a given option.",
      "1x2 (Match/Half/Extra Time/Penalties):  The team that officially win the match or specified period. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total (Match/Half):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Floorball",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tExtra time and Penalties are only considered in bets on the match winner, to qualify markets.",
      "•\tIn an event that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the event, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2:  The team that officially win the match. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total:  The total number of points scored in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting: Determined by which team will win the match once the specified handicap is applied to the result of the match or named period."
    ]
  },
  {
    "title": "Formula 1",
    "paragraphs": [
      "•\tAll markets will be settled on results given at the time of the podium ceremony or no more than 15 minutes after the completion of the specified session.",
      "•\tFor any event that has reduced amount of laps or becomes a timed race due to weather conditions or other circumstances will be settled according to the official results for the period determined by the official governing body.",
      "•\tIf a specific event is postponed or abandoned, an event must be run within 72 hours of the scheduled start time of the original event. If the event is not resumed, all unsettled bets will be made void",
      "•\tIn the event a selection is not able to participate an event, bets will be void unless they participate in the warm up lap or leave the pit lane within the first lap of the race.",
      "•\tIn order to be classified, a driver must complete at least the 90% of the laps completed by the winner.",
      "•\tFor settlement purposes, a disqualified driver is considered as a retirement.",
      "•\tIf two or more drivers retire during the same lap they will be considered as finishing at the same time. Dead-Heat rules apply.",
      "•\tRule 4 deductions may apply on ‘Practice Session’ markets for any drivers who do not complete at least one lap during the session. (TBC)",
      "•\tDead Heat rules apply"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Race/Qualifying/Free Practice): Settled as the official winner of the race (Sprint races will be clearly labelled in the market name) or specified session.",
      "Winning Constructor (Race/Qualifying/Free Practice): Settled as the constructor represented by the winning driver of the race (Sprint races will be clearly labelled in the market name) or specified session.",
      "Winning Margin: Settled as the margin of victory (in seconds) of the race. Penalties applied after the trophy presentation will not count towards settlement of the market.",
      "Top 3 Finish: Settled as a driver(s) finishing the race within the first three positions.",
      "Top 6 Finish: Settled as a driver(s) finishing the race within the first six positions.",
      "H2H Finish (Race/Qualifying/Free Practice): Settled on which of the two named drivers will achieve the best position in official race classification or specified session. If both drivers fail to finish the race, the winner is determined by the driver who completed most laps. Bets will be void if both drivers retire on the same lap and within the same timing sector.",
      "Any Driver to win Race, Pole Position and Fastest Lap: Determined on whether or not the driver who starts in Pole Position will also win the race and set the fastest lap.",
      "First Driver to Make a Pit Stop: Settled as the driver who makes the first pit stop during the race.",
      "Grid Position of Winner: Settled as the starting position of the driver who wins the race.",
      "Winning Nationality: Determined by the nationality of the winner of the race.",
      "Number of Classified Drivers: Settled as the number of drivers who officially finish the race.",
      "Fastest Lap: Settled as the driver who officially records the fastest lap during the race.",
      "First Driver Retirement: Determined by the driver who retires first during the race. In the event multiple retirements occur on the same lap; Dead Heat deductions apply.",
      "First Constructor Retirement: Determined by the constructor who retires first during the race. In the event multiple retirements occur on the same lap; Dead Heat deductions apply.",
      "Will There Be A Safety Car Period During the Race:  Settled on whether there is a safety car deployed during the race.",
      "Will There Be A Virtual Safety Car Period During the Race: Settled on whether there is a virtual safety car deployed during the race. A virtual safety car must be in place for a complete lap excluding the current lead lap.",
      "Championship Winner (Drivers): Settled as the driver who wins the FIA Formula 1 World Drivers Championship.",
      "Championship Winner (Constructors): Settled as the constructor who wins the FIA Formula 1 World Constructors Championship."
    ]
  },
  {
    "title": "Futsal",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2 (Match/Half/Overtime):  The team that officially win the match or specified period. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total Goals (Match/Half/Overtime):  The total number of goals scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting (Match/Half):  Determined by which team will win the match or specified period once the specified handicap is applied to the result of the match or named period.",
      "Double Chance: Settled as the official result of the match being included in the selection, where two of the three possible selection will be winners and one selection will be a loser.",
      "Draw no Bet: Determined by the winner of the game in regular time. If the game ends in a tie, bets are void.",
      "Both Teams to Score: Determined when both teams score at least one goal in the match in regular time.",
      "Correct Score: Settled on the correct prediction of the final score in the match.",
      "Xth Goal – Settled as the team who scores the named goal.",
      "Odd/Even - Determined by the total points scored in the match or specified period being either odd or even.",
      "Penalty Shootout – Winner: Settled as the team who wins the Penalty Shootout. If the game does not go to a penalty shootout, all bets will be void."
    ]
  },
  {
    "title": "Handball",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tA minimum of 50 minutes must be played for bets to be valid."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2 (Match/Half): The team that officially win the match or specified period. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total (Match/Half): The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap (Match/Half):  Determined by which team will win the match or specified period once the specified handicap is applied to the result of the match or named period.",
      "Double Chance (Match/Half): Settled as the official result of the match being included in the selection, where two of the three possible selections will be winners and one selection will be a loser.",
      "Draw No Bet (Match/Half): Determined by the winner of the game in regular time or specified period. If the game ends in a tie, bets are void.",
      "Halftime/Fulltime: Settled on the official winner of the first half of the game and the full-time result.",
      "Xth Goal (Match/Half): Settled as the team who scores the named goal.",
      "Race to X Points (Match/Half): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Odd/Even (Match/Half): Determined by the total points scored in the match or specified period being either odd or even.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Ice Hockey",
    "paragraphs": [
      "• All match markets will be settled on regulation time (specific to the competition) unless stated otherwise e.g., overtime/shootout included. • In a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared. • Goals scored in overtime will not be counted for markets relating to the 3rd period. • In the event of a two-legged match and the aggregated scores are tied at the end of the 2nd game, unless the 2nd leg match score is tied bet will be settled on the end of regular play result, excluding overtime. • Player specific markets will be settled on the official statistics. If a player does not play in a game, the bet will be void. Overtime counts for all player prop markets in a game. • For Other Outright Markets, all bets will be settled on the team or player that wins the overall event or award, unless otherwise specified in the market (for example; Regular Season Winner). • Double minor penalties will count as 2 separate minor penalties for all penalty markets.  • In the event of a game being decided by a penalty shootout, one goal will be added to the winning team's score and the game total for settlement purposes. This applies only to markets that include overtime and shootouts. Markets excluding overtime/shootouts are not affected."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner 2 Way / Moneyline (Match/Period):  The team which officially wins the match or specified period. Bets on the match winner/moneyline are settled on the winner of the game, including overtime and shootouts.",
      "1X2 (Match/Period):  The team that officially wins the match or specified period. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total Goals (incl. overtime and shootouts):  The total number of goals scored in the match, including overtime and shootouts. In the case of a shootout, one goal is added to the winning team for settlement purposes.",
      "Team Total Goals (incl. overtime and shootouts):  The total number of goals scored by the specified team, including overtime and shootouts.",
      "Total (Match/Period):  The total number of goals scored in the match or specified period. Excludes Overtime and Shootouts unless stated in the market name.",
      "Handicap/ Spread (incl. overtime and shootouts) (Match/Period):  Determined by which team will win the match once the specified handicap is applied to the overall match or specified period score. Includes overtime and shootouts where specified.",
      "Winner 3 Way / 1X2 (Match/Period):  The official winner in the match or specified period. Bets are settled on either the Home, Tie or Away team who score the most goals.",
      "Total 3-Way (Match/Period):  The total number of goals scored in the match or specified period.",
      "Home/Away Total (Match/Period):  The number of goals scored in the match or specified period by a specific team. Excludes Overtime and Shootouts unless stated in the market name.",
      "Double Chance (Match/Period):  Settled as the official result of the match or specified period being included in the selection, where two of the three possible selections will be winners and one selection will be a loser.",
      "Draw No Bet (Match/Period):  Determined by the winner of the game in regular time or specified period. If the game ends in a tie, bets are void.",
      "Correct Score (Match/Period):  Settled on the correct prediction of the final score in the match or specified period. Excludes Overtime and Shootouts, regular time only.",
      "Xth Goal (Match/Period):  Settled as the team who scores the named goal in the specified period.",
      "Both Teams to Score (Match/Period):  Determined when both teams score at least one goal in the match in regular time or the specified period.",
      "Odd/Even (incl. overtime and shootouts): Determined by the total number of goals scored in the match or specified period being either odd or even, including overtime and shootouts.",
      "Team Odd/Even (incl. overtime and shootouts):  Determined by the total number of goals scored by the specified team, including overtime and shootouts, being either odd or even.",
      "Last Team to Score (Match/Period):  Settled as the team who scores the last goal of the match in regular time or specified period. Bets are void if no goal is scored in regular time.",
      "Highest Scoring Period:  Settled as the period of the match which contains the highest number of goals. Dead Heat rules apply.",
      "Anytime Goalscorer:  Settled as a player who will score a goal at any point during the match (excluding overtime or penalty shootouts).",
      "Will There Be Overtime:  Determined by whether the match will go to a period of Overtime at the end of regular time.",
      "Home/Away To Win All Periods: Determined by whether the named team will win each individual period of the match.",
      "Event – Winner: Predict which team will win the named event.",
      "Stanley Cup – Winner: Settled as the team who wins the NHL Stanley Cup.",
      "NHL - Eastern Conference – Winner: Settled as the representative team from the Eastern Conference in the NHL Stanley Cup.",
      "NHL – Western Conference – Winner: Settled as the representative team from the Western Conference in the NHL Stanley Cup.",
      "NHL – Winning Conference: Settled as the conference which provides the team who win the NHL Stanley Cup.",
      "NHL – Winning Division: Settled as the division which provides the team who win the NHL Stanley Cup.",
      "NHL – Division – Winner: Settled as the team who wins the named division at the end of the regular season.",
      "Team – Regular Season Wins: Determined by the total number of wins the given team has at the end of the regular season, being under or over the given total of wins.",
      "Will They Make the Playoffs – Team: Determined by whether the quoted team advance into the playoffs at the end of the regular season."
    ]
  },
  {
    "title": "Kabaddi",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tExtra time will not count towards regular time or half bets unless stated.",
      "•\tRegulation time must be played in full for bets to be valid."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Half): The team which officially wins the match. In the event of a tie after regular time, bets will be settled as the winner in overtime where played. Bets void if a tie is the final result."
    ]
  },
  {
    "title": "Lacrosse",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time including overtime (specific to the competition) unless stated otherwise.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: The team which officially wins the match. In the event of a tie after regular time, bets will be settled as the winner in overtime where played. Bets void if a tie is the final result.",
      "Total: The total number of points scored in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting: Determined by which team will win the match once the specified handicap is applied to the result of the match or named period."
    ]
  },
  {
    "title": "MMA (Mixed Martial Arts)",
    "paragraphs": [
      "•\tThe start of the fight is determined by the bell signal at the beginning of the first round. In cases where a fighter cannot continue the match after the bell signal at the start of the next round, the fight is considered ended in the previous round",
      "•\tIn an event that is postponed or abandoned, all bets are void if the event is not resumed within 24 hours of the scheduled end of the event.",
      "•\tIf for any reason the selected number of rounds on which we're betting is changed, all bets on the event will be made void other than the declared fight winner.",
      "•\tShould there be a withdrawal or a substitution of one of the fighters concerned, bets will be void.",
      "•\tIn the event of a no contest. All unsettled bets will be made void.",
      "•\tEvents are settled on the scorecards and results announced immediately after the end of the fight. Further appeals or amendments are not taken into account for settlement purposes.",
      "•\tIn the event a clear result, decision or method of victory cannot be established within 24 hours, all bets will be made void.",
      "•\tWhen calculating the \"Total rounds\" result, up to the midpoint of the round (0:00 to 2:29) is rounded down, and (02:30 to 05:00) is rounded up for settlement purposes.",
      "•\tIn the event of collusion by either bettors or the fighter, we reserve the right to withhold settlement and void bets.",
      "•\tStats related markets including strikes, takedowns, knockdowns and strike zones are settled according the statistics published by the governing body. Where these are not available, we reserve the right to use data suppliers or press association published statistics.",
      "•\tAny market for tournament betting includes the bouts in the Main advertised card, Prelims and Early Prelim fights."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: Determined by which fighter officially wins the match. In the event of a draw, bets will be made void",
      "1x2:  The fighter that officially win the match. Settled either as named Red corner fighter, draw or named Blue corner fighter.",
      "Total Rounds: The total number of rounds fought in the match. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Winning Method: Predict exact method of victory of the fight.",
      "Winner & Exact Rounds: The winner of the fight, along with the exact round in which the fight will end.",
      "Will The Fight Go The Distance: Determined by whether the fight ends before the completion of all scheduled rounds.",
      "Will there be a draw in the tournament: Settled on whether any bout ends in a draw through the named tournament.",
      "Will a win be a split decision in the tournament: Settled on whether any bout ends with a split decision through the named tournament.",
      "Will there be a No Contest decision in the tournament: Settled on whether any bout ends in a no contest through the named tournament",
      "First minute of the fight win in the tournament: Settled on whether any bout ends with a victory declared between 00:00 to 00:59 of round 1 through the named tournament",
      "Last minute of the fight win in the tournament: Settled on whether any bout ends with a victory declared between 04:00 to 05:00 of the last advertised round through the named tournament",
      "Will a win be by disqualification in the tournament: Settled on whether any bout ends in a disqualification through the named tournament.",
      "Will there be a fight with two or more knockdowns in the tournament: Settled on whether any bout ends with two or more official knockdowns through the named tournament.",
      "Will there be a fight with five or more takedowns in the tournament: Settled on whether any bout ends with five or more official knockdowns through the named tournament.",
      "Will there be a fight with 400+ significant strikes in the tournament: Settled on whether any bout ends with 400 or more significant strikes through the named tournament.",
      "Strike of three or more KO/TKO wins in a row in the tournament: Settled on whether three or more sequential bouts end in KO or TKO wins through the named tournament.",
      "Strike of three or more submission wins in a row in the tournament: Settled on whether three or more sequential bouts end in submission wins through the named tournament.",
      "Strike of three or more decision wins in a row in the tournament: Settled on whether three or more sequential bouts end in a judge’s scorecard decision through the named tournament.",
      "Total wins by KO/TKO in the tournament: Settled on the total number of bouts won by KO/TKO through the named tournament being higher or lower than the given line.",
      "Total wins by submission in the tournament: Settled on the total number of bouts won by submission through the named tournament being higher or lower than the given line.",
      "Total wins by first round in the tournament: Settled on the total number of bouts won in the first round through the named tournament being higher or lower than the given line.",
      "Total wins by decision in the tournament: Settled on the total number of bouts won by decision through the named tournament being higher or lower than the given line.",
      "Total wins by split/majority decision in the tournament: Settled on the total number of bouts won by split or majority decision on the judges’ scorecards through the named tournament being higher or lower than the given line."
    ]
  },
  {
    "title": "Motorcycle Racing",
    "paragraphs": [
      "•\tAll markets will be settled on results given at the time of the podium ceremony or no more than 15 minutes after the completion of the specified session.",
      "•\tFor any event that has reduced amount of laps or becomes a timed race due to weather conditions or other circumstances will be settled according to the official results for the period determined by the official governing body.",
      "•\tIf a specific event is postponed or abandoned, an event must be run within 72 hours of the scheduled start time of the original event. If the event is not resumed, all unsettled bets will be made void",
      "•\tIn the event a selection is not able to participate an event, bets will be void unless they participate in the warm up lap or leave the pit lane within the first lap of the race.",
      "•\tIn order to be classified, a rider must complete at least the 90% of the laps completed by the winner.",
      "•\tFor settlement purposes, a disqualified rider is considered as a retirement.",
      "•\tIf two or more riders retire during the same lap they will be considered as finishing at the same time. Dead-Heat rules apply.",
      "•\tRule 4 deductions may apply on ‘Practice Session’ markets for any riders who do not complete at least one lap during the session.",
      "•\tDead Heat rules apply"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Race/Qualifying/Free Practice): Settled as the official winner of the race or specified session.",
      "Winning Constructor (Race/Qualifying/Free Practice): Settled as the constructor represented by the winning driver of the race or specified session.",
      "Winning Margin: Settled as the margin of victory (in seconds) of the race. Penalties applied after the trophy presentation will not count towards settlement of the market.",
      "Top 3 Finish: Settled as a rider(s) finishing the race within the first three positions.",
      "Top 6 Finish: Settled as a rider(s) finishing the race within the first six positions.",
      "H2H Finish (Race/Qualifying/Free Practice): Settled on which of the two named riders will achieve the best position in official race classification or specified session. If both riders fail to finish the race, the winner is determined by the rider who completed most laps. Bets will be void if both riders retire on the same lap and within the same timing sector.",
      "Any Rider to win Race, Pole Position and Fastest Lap: Determined on whether or not the rider who starts in Pole Position will also win the race and set the fastest lap.",
      "First Rider to Make a Pit Stop: Settled as the rider who makes the first pit stop during the race.",
      "Grid Position of Winner: Settled as the starting position of the rider who wins the race.",
      "Winning Nationality: Determined by the nationality of the winner of the race.",
      "Number of Classified Riders: Settled as the number of riders who officially finish the race.",
      "Fastest Lap: Settled as the rider who officially records the fastest lap during the race.",
      "First Rider Retirement: Determined by the rider who retires first during the race. In the event multiple retirements occur on the same lap; Dead Heat deductions apply.",
      "First Constructor Retirement: Determined by the constructor who retires first during the race. In the event multiple retirements occur on the same lap; Dead Heat deductions apply.",
      "Will There Be A Safety Car Period During the Race:  Settled on whether there is a safety car deployed during the race.",
      "Will There Be A Virtual Safety Car Period During the Race: Settled on whether there is a virtual safety car deployed during the race. A virtual safety car must be in place for a complete lap excluding the current lead lap.",
      "Championship Winner (Riders): Settled as the rider who wins the World Drivers Championship.",
      "Championship Winner (Constructors): Settled as the constructor who wins the World Constructors Championship."
    ]
  },
  {
    "title": "Netball",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time including overtime (specific to the competition) unless stated otherwise.",
      "•\tOvertime will count towards all 2nd Half and 4th Quarter markets, but not Match winner markets if a tie option is offered.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Half/Quarter): The team which officially wins the match or specified period. Overtime does not count if the draw option is offered."
    ]
  },
  {
    "title": "Rugby: Union/League/Sevens",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise. This includes injury time if added at the end of regulation time, but excludes extra time or penalties unless specified in the market.",
      "•\tIn an event that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the event, unless an official winner is declared.",
      "•\tPenalty tries – All Penalty tries do not count for the settlement of first / last tryscorer betting. However, they do count towards all total try markets"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2 (Match/Half/Overtime):  The team that officially win the match or specified period. Settled on the result of regular time only, with either the home, draw or away market being declared the winner.",
      "Total Points (Match/Half/Overtime):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Handicap Betting (Match/Half):  Determined by which team will win the match or specified period once the specified handicap is applied to the result of the match or named period.",
      "Draw No Bet (Match/Half): Determined by the winner of the game in regular time or specified period. If the game ends in a tie, bets are void.",
      "Halftime/Fulltime: Settled on the official winner of the first half of the game and the full time result.",
      "Winning Margin (Match/Half): Settled as the margin of victory (total number of points difference) of the match.",
      "Home/Away Total Points (Match/Half): The number of points scored in the match or specified period by a specific team. Bets settlement is determined on whether the result will be over or under the line taken for the named team.",
      "Total Tries (Match/Half): Settled as the total number of tries scored in the match or specified period being over or under the specified line.",
      "Home/Away Total Tries (Match/Half): Settled as the total number of tries scored in the match or specified period being over or under the specified line for the named team in regulation time.",
      "Total Points Odd/Even (Match/Half):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Total Tries Odd/Even (Match/Half):  Determined by the total tries scored in the match or specified period being either odd or even.",
      "Double Chance (Match/Half): Settled as the official result of the match being included in the selection, where two of the three possible selections will be winners and one selection will be a loser.",
      "Race to X Points (Match/Half): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Next Scoring Play: Settled as the method scored in the next scoring play from the time the bet is struck.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Ski Jumping",
    "paragraphs": [
      "•\tEvents will be settled based on the result provided by the official governing body.",
      "•\tOutright Selections are deemed as runners regardless of whether the selection does not take part in the event. If a competitor does not take part, they will be settled as a loser.",
      "•\tIf a competitor is disqualified during the event, then they will be settled as a loser.",
      "•\tIn case of an event being abandoned and no official winner is declared; the event will be declared void.",
      "•\tDead Heat rules apply."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Event - Winner: Competitor declared the winner at the end of a single day event or multiday tournament dependent on the specified event."
    ]
  },
  {
    "title": "Snooker",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tShould a match not be finished, or a replacement player be involved in the scheduled fixture, all unsettled bets will be void.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Match winner: The player who officially wins the match or specified period. In the event of a tie, all bets will be voided unless the draw is a given option.",
      "Event – Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Soccer",
    "paragraphs": [
      "•\tAll markets will be settled in accordance to the official results of the governing body.",
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise. This includes injury time if added at the end of regulation time, but excludes extra time, penalties or golden goal unless specified in the market.",
      "•\tIn a fixture that is delayed, postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tIf a match does not conform with the generally accepted format of play (Length of periods of play, format of match, refereeing code etc) then we reserve the right to void all bets.",
      "•\t90-minute matches must complete a minimum of 75 minutes to be settled. All matches ended with an official result prior to 75 minutes will be made void.",
      "•\tIf odds were offered with an incorrect match time live of 5 minutes or more, we reserve the right to void bets placed since the incident occurred.",
      "•\tFor settlement purposes, stats-based markets such as free-kicks, throw-ins and corners that are awarded but not taken are not considered as part of the totals markets.",
      "•\tIn the event a goal is incorrectly awarded, either by a VAR review or data error; we reserve the right to void all bets and markets from the time of the error.",
      "•\tGames or markets where a result cannot be found will result in bets being made void 48 hours after the game has kicked off and the stake will be refunded, unless your bet involves more than one selection, in which case it will be settled on the remaining selections.",
      "•\tTiming markets will be taken from the information published by the live feed provider or competition website if this data is unavailable.",
      "•\tWhere data is not provided by the governing body, markets will be settled based on statistics provided by the Press Association unless there is clear evidence that these statistics are not correct.",
      "•\tIn friendly matches or games on a neutral venue, the home team is for identification purposes only and not grounds for bet cancellation.",
      "•\tMarkets will be settled based on the goal time announced by TV. If this is not available, the time according to the match clock is considered.",
      "•\tGoal Markets are settled based on the time the ball crosses the line, and not the time the kick is made.",
      "•\tCorner Total markets are settled based on the time the corner kick is taken and not the time the corner is conceded or awarded.",
      "•\tBooking interval markets are settled based on the time the card is shown and not the time the infringement is made.",
      "•\tOffsides will be settled based on the time when the referee gives the decision. This rule will be applied to any video assistant referee (VAR) situation.",
      "•\tPenalty markets will be settled based on the time when the referee awards the decision. This rule will be applied to any video assistant referee (VAR) situation.",
      "•\tPenalties awarded but not taken are not considered for settlement purposes such as when a penalty decision is reviewed by VAR and rescinded."
    ]
  },
  {
    "title": "Card Settlement rules",
    "paragraphs": [
      "•\tYellow cards count as 1 card and a second yellow card or a straight red to the same player would count as 1 red. Consequently, one player cannot count for more than 2 cards.",
      "•\tSettlement will be made according to all the officially stated number of cards shown during the regular 90 minutes of play by the governing body. Where this information is not instantly available, data providers or press association sources will be used for settlement purposes.",
      "•\tAny card given either before or after the game begins or ends will not be counted.",
      "•\tCards for anyone not on the field of play (already substituted players, managers, players on bench) are not counted in the card markets.",
      "•\tIf a substitute is booked while on the bench, the card will count only if he later appears on the pitch; the time is settled as when the card was shown.",
      "•\tCards at half time count if the player appears in the next half, for example; a red card at HT counts as the 46th minute if he was active at end of 1st half.",
      "•\tCards after full time do not count for regulation card markets.",
      "•\tIf the match is abandoned before 90 minutes, Player card markets are void unless the specific outcome is already determined (e.g., First Player To Be Booked being already known).",
      "•\tFirst Player to be Booked – the winner is simply the first player shown a card (yellow or red); in a multi card incident, the one shown first. Same abandonment and participation rules apply.",
      "•\tCards of other colours being shown will be disregarded unless a specific market exists."
    ]
  },
  {
    "title": "Time Frame Betting",
    "paragraphs": [
      "•\tTime frames are defined as follows: 1-10 minutes is 0:00-9:59, 11-20 minutes is 10:00-19:59, etc. 1-15 minutes is 00:00-14:59, 16-30 minutes is 15:00-29:59, etc. Time periods 31-45 and 76-90 include any added time (Unless the outcome of the specific market is already determined).",
      "•\t1st/2nd Half Markets apply to the statutory 45 minutes play, including injury time and added time"
    ]
  },
  {
    "title": "Player Markets Rules",
    "paragraphs": [
      "•\tIf a player was not in the starting lineup, bets placed before kick-off will be voided. If a player comes on during the game, live bets placed during the game on the player remain valid",
      "•\tIf a match is abandoned after the first goal then First Goalscorer and Anytime Goalscorer bets on players who already scored will stand. All other goalscorer bets will be void. If the match is abandoned before any goal is scored then all goalscorer bets will be void.",
      "•\tAll bets created prior to a venue change shall be voided.",
      "5-Minute Interval Markets – Settlement Rules"
    ]
  },
  {
    "title": "General Rules (applies to all markets below)",
    "paragraphs": [
      "•\tAll markets are settled in real time once the outcome is decided.",
      "•\tIf a match is abandoned after it has started:",
      "•\tPlayer Markets that have already been decided will stand.",
      "•\tPlayer Markets that have not yet reached a result will be void.",
      "•\tAll player markets apply to regular time only (unless stated otherwise).",
      "•\tEach market applies to fixed and stated 5-minute windows (e.g. 1:00–5:59, 6:00–10:59, etc.).",
      "•\tSeparate markets are created for each interval.",
      "•\tSettlement for interval markets on cards/corners relates to when the referee awards the corner or shows the card."
    ]
  },
  {
    "title": "Match Result 1x2 (5 Minutes)",
    "paragraphs": [
      "•\tPredict the result (Home/Draw/Away) within the specified 5-minute period.",
      "•\tOwn goals count toward the result."
    ]
  },
  {
    "title": "Next Team to Score (5 Minutes)",
    "paragraphs": [
      "•\tPredict which team will score the next goal within the stated 5-minute period.",
      "•\tOwn goals count for the benefiting team."
    ]
  },
  {
    "title": "Corner Awarded (5 Minutes – Yes/No)",
    "paragraphs": [
      "•\tPredict whether a corner will be awarded in the 5-minute period.",
      "•\tMarkets are created:",
      "•\tBefore each half starts",
      "•\tAnd 1.5 minutes before each interval during play",
      "•\tMarkets close 30 seconds before the next interval begins.",
      "•\tSettlement is based on when the corner is awarded, not when it is taken."
    ]
  },
  {
    "title": "Most Corners (5 Minutes)",
    "paragraphs": [
      "•\tPredict which team will have the most corners in the 5-minute period."
    ]
  },
  {
    "title": "Card Awarded (5 Minutes – Yes/No)",
    "paragraphs": [
      "•\tPredict whether any card (yellow or red) will be shown in the period.",
      "•\tMarkets follow the same timing rules as Corner markets:",
      "•\tCreated before halves and shortly before each interval",
      "•\tClosed 30 seconds before the next interval",
      "•\tAny card counts."
    ]
  },
  {
    "title": "Most Carded Team (5 Minutes)",
    "paragraphs": [
      "•\tPredict which team will receive the most cards in the period.",
      "•\tAll cards count as 1, regardless of type (yellow/red)."
    ]
  },
  {
    "title": "Next Carded Team (5 Minutes)",
    "paragraphs": [
      "•\tPredict which team will receive the next card in the period.",
      "•\tAll cards count as 1, regardless of type."
    ]
  },
  {
    "title": "Goal Handicap (5 Minutes)",
    "paragraphs": [
      "•\tA virtual goal handicap is applied to one team for the specified 5-minute period.",
      "•\tSettlement is based only on goals scored within that 5-minute interval.",
      "•\tThe handicap is applied to the score at the end of the interval to determine the result.",
      "•\tThe team with the higher adjusted score is the winner."
    ]
  },
  {
    "title": "Total Goals (5 Minutes)",
    "paragraphs": [
      "•\tPredict the total number of goals scored within the specified 5-minute interval (e.g. Over/Under).",
      "•\tOnly goals scored during that exact 5-minute period count.",
      "•\tOwn goals count toward the total.",
      "•"
    ]
  },
  {
    "title": "Soccer stats used on player markets",
    "paragraphs": [
      "Assists: A final contribution (pass, shot or any other touch of the ball) made by a player leading to the receiving teammate scoring a goal.",
      "Goals: The number of goals scored by a player in the opposition net. markets are settled based on the time the ball crosses the line, and not the time the kick is made",
      "Shots: Any clear attempt by a player to score a goal (on target, off target or blocked)",
      "Passes: Attempted pass (successful or unsuccessful) with the clear intention of one player to find a teammate.",
      "Tackles: When a player connects with the ball in a ground challenge, successfully taking the ball away from the player in possession.",
      "Cards: Player carded: 0 = No, 1 = Yes (not the total number of cards received).",
      "Shots on Goal / Shots on Target: An attempt by a player which directly results in a goal (regardless of clear intent to score a goal), or a clear attempt by a player to score a goal that clearly would have gone into the net if not for a goalkeeper save or a stop made by the last man (with the goalkeeper clearly unable to save)"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2 (Match/Half/Extra time):  The team that officially win the match or specified period. Settled on the result of regular time only including injury time, with either the home, draw or away selection being declared the winner.",
      "Total Goals (Match/Half/Extra time):  The total number of goals scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Draw no Bet: Determined by the winner of the game in regular time. If the game ends in a tie, bets are void.",
      "Handicap Betting (Match/Half):  Determined by which team will win the match or specified period once the specified handicap is applied to the result of the match or named period. Includes both European and Asian handicap. Where a draw is the result, that part of the bet will be a push (stake returned for that part of the bet).",
      "Correct score (Match/Half): Settled on the correct prediction of the final score in the 90 minutes or specified period.",
      "Double chance (Match/Half):  Settled as the official result of the match being included in the selection, where two of the three possible selection will be winners and one selection will be a loser (Home & Away, Home & Draw or Away & Draw)",
      "Halftime / Fulltime: Settled as the winning outcome of the first half of the match together with the winning outcome of the entire match.",
      "Both teams to score (Match/Half): Determined when both teams score at least one goal in the match in regular time.",
      "Time of the 1st goal: Settled as the timeframe of the game’s first goal falling before or after a specified time.",
      "Method of victory: Settled as the method of victory for the home or away team from the 6 available possible outcomes.",
      "Which team will win the rest of the match: Settled as who will win the match from a set period. At the time of bet placement, the scores are considered to be 0-0.",
      "Number of corners: Settled by the total match corners. Corners awarded but not taken do not count.",
      "Next corner: Settled as who will be awarded the next match corner from the time of bet placement.",
      "Last corner: Settled as who will be awarded the last match corner from the time of bet placement.",
      "Total Yellow Cards:  Determined by the total number of bookings awarded during the match being over or under a specific line.",
      "Total home or away team corners: Determined by how many corners are taken by the home or away team will be over or under the specified line.",
      "Last goal scorer: Settled as the last player to score a goal in the match. If the selected player plays no part in the match, bets are void. If the chosen player scores no goals and is substituted before the last match goal is scored, bets are losers.",
      "Correct Score x:y Settled as the final score for the remainder of the match from the current score when the bet is placed.",
      "Total & Both Teams to score: Determined by the total match goals being over or under the specified line and both team's score.",
      "1x2 & Both Teams to Score: Determined by the winning outcome of the game and if both teams will score or not.",
      "Halftime / Fulltime + Correct Score: Settled by the correct outcome of the first half of the match together with the correct outcome of the entire match and the correct score."
    ]
  },
  {
    "title": "Goals Markets",
    "paragraphs": [
      "First Goal/ Last Goal: Settled on who will score first or last goal either home, away or none.",
      "Odd/Even (Match/Half): Settled on whether the total match, home team or away team score. Will it be odd or even in the specified period.",
      "Home/Away Totals (Match/Half):  Determined by the home or away total goals scored in the specified period",
      "Match Exact Goals / Team Exact Goals: Settled on the correct number of goals in the game or by each team.",
      "Which Team to Score: Betting on Home, Away, Both or none to score.",
      "Highest Scoring Half: Betting on which half will have the most goals first, second or equal.",
      "Clean Sheet: Betting on the home or away team not to concede a goal.",
      "To Score In Both Halves: Betting on the home or away team to score in both halves.",
      "Both Halves: Over/Under Betting on away or home team to score over or under a specific line.",
      "Win To Nil: Betting on the home or away team to win and not concede a goal.",
      "Clean Sheet: Betting on the home or away team to not concede a goal.",
      "First goal scorer: Settled on the selected player scoring the first goal of the match. Bets are void on a player unless they start the match. The usual 90 minutes betting rule applies, and own goals do not count for settlement purposes.",
      "Anytime goal scorer: Settled on a player scoring a goal anytime during the match. Should your player not come off the bench or start the match, the bet will be void. The usual 90 minutes betting rule applies, and own goals do not count for settlement purposes.",
      "Winning Margin: Determined by whether the home or away team win by 1,2 or 3 or goals or draw.",
      "Which Team to Score: Either Home, away, none or both."
    ]
  },
  {
    "title": "Specials",
    "paragraphs": [
      "•\tSpecials shall be settled on official results relating the named market.",
      "•\tWhere multiple winners of an outright market occur, dead heat rules apply.",
      "•\tAll bets will remain valid if new selections are added to the market after the time of bet.",
      "•\tBets will remain valid for up to 1 calendar year of the quoted timeframe of an event where a specific date has not been released by the governing body of the named market."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Award/Event – Winner: settled as the named winner of the specified award/event.",
      "Event - Top 10 Finish: Settled on the official results of the event. Any participant in the top 10 of the field, will be settled as a winner.",
      "Event – Top Region / Country: Settled on the official results of the event. The participant with the best ranked performance within the selections for the applicable market will be settled as a winner.",
      "Head-To-Head: Settled on which of the two named participants will achieve the best official result. Bets will be void if neither participant competes or is eligible to win."
    ]
  },
  {
    "title": "Stock Car Racing / NASCAR/ Indycar",
    "paragraphs": [
      "•\tAll markets will be settled on results given at the time of the podium ceremony or no more than 15 minutes after the completion of the specified session.",
      "•\tFor any event that has reduced amount of laps or becomes a timed race due to weather conditions or other circumstances will be settled according to the official results for the period determined by the official governing body.",
      "•\tIf a specific event is postponed or abandoned, an event must be run within 72 hours of the scheduled start time of the original event. If the event is not resumed, all unsettled bets will be made void",
      "•\tIn the event a selection is not able to participate an event, bets will be void unless they participate in the warm up lap or leave the pit lane within the first lap of the race.",
      "•\tFor settlement purposes, a disqualified driver is considered as a retirement.",
      "•\tIf two or more drivers retire during the same lap they will be considered as finishing at the same time. Dead-Heat rules apply.",
      "•\tDead Heat rules apply"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Race/Qualifying/Free Practice): Settled as the official winner of the race or specified session.",
      "Winning Constructor (Race/Qualifying/Free Practice): Settled as the constructor represented by the winning driver of the race or specified session.",
      "Winning Margin: Settled as the margin of victory (in seconds) of the race. Penalties applied after the trophy presentation will not count towards settlement of the market.",
      "H2H Finish (Race/Qualifying/Free Practice): Settled on which of the two named drivers will achieve the best position in official race classification or specified session. If both drivers fail to finish the race, the winner is determined by the driver who completed most laps. Bets will be void if both drivers retire on the same lap and within the same timing sector.",
      "Top 3 Finish: Settled as a driver(s) finishing the race within the first three positions.",
      "Championship Winner (Drivers): Settled as the driver who wins the stated series championship."
    ]
  },
  {
    "title": "Table Tennis",
    "paragraphs": [
      "•\tAll match markets will be settled on regulation time (specific to the competition) unless stated otherwise.",
      "•\tIn the event of retirement or disqualification; the minimum of 1 complete set must be played for bets on the match winner to be settled. All unsettled markets will be made void.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tShould a player be replaced during a team competition with 3+ players in the team, bets will remain valid.",
      "•\tShould a player retire due to injury, match winner bets will be settled on the player advancing to the next round. All other markets will be settled where possible until the point of retirement, with any undetermined markets made void.",
      "•\tOfficial points deductions will be taken into account for all undetermined markets. Markets which have already been determined will not take deductions into account."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Set/Game): The player/team which officially wins the match. In the event of a tie after overtime, all bets will be voided unless the draw is a given option.",
      "Total Points (Match/Set/Game):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Home/Away Total Points (Match/Set/Game): The number of points scored in the match or specified period by a specific player/team. Bets settlement is determined on whether the result will be over or under the line taken for the named player/team.",
      "Point Handicap (Match/Set/Game):  Determined by which player/team will win the match or specified period once the specified handicap is applied to the result of the match or named period.",
      "Correct Score (Match/Set/Game): Settled on the correct prediction of the final score in the match or specified period.",
      "Odd/Even Total Points (Match/Set/Game):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Winning Margin (Match/Set/Game): Settled as the margin of victory (total number of points difference) of the match or specified period.",
      "Xth Game – Xth Point: Settled as the player/team who scores the named point in the specified game.",
      "Xth Game – Race To X Points: Settled on either the home player/team or away player/team being the first to score the specified number of points in the given game.",
      "Xth Set – Extra Points: Settled on how many games in the match require additional points above the standard winning total within the specified set played.",
      "Xth Set – Two points in a row: Settled on whether a player wins two or more points in a row during the specified set.",
      "Xth Set - Win + Total Points: Settled as correctly predicting the player/team who wins the set with the correct total points scored in the set.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Tennis",
    "paragraphs": [
      "•\tIn the event of a weather delay, schedule change to the order of play or change in time and date of the scheduled match; bets will remain valid unless a walkover or official result is declared. This includes if a match has already begun and been suspended due to time restrictions or bad light.",
      "•\tIn the event of a walkover, retirement or a default from any player. All un-resulted markets will be made void except the match winner (provided the minimum game length has been played).",
      "•\tIf a challenge is made or a penalty point awarded, all bets will be settled/resettled on the official score.",
      "•\tIn the event a match finishes before certain points/games are completed, all affected markets with unsettled bets are void.",
      "•\tFor settlement purposes, each tie-break or match tie-break is settled as 1 game.",
      "•\tIn the event of a retirement, set and game related markets that were already settled as lost will remain, unsettled bets will be made void.",
      "•\tIn the event of a venue or surface change. All bets will remain valid.",
      "•\tA minimum of 1 full set must be completed for the match winner to be settled. All other unsettled markets will be void.",
      "•\tIn the event a of a walkover, retirement or default; all un-resulted markets will be made void except the match winner market regardless of the probability of a result being achievable or not."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Set/Game): The player/team who officially wins the match or specified period. In the event of a tie, all bets will be settled by the tie-break winner.",
      "Total Games (Match/Set/Game): The total number of games played in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Player/Team Total Games (Match/Set/Game): The total number of games won in the match or specified period by a specific player/team. Bets settlement is determined on whether the result will be over or under the line taken.",
      "Correct Score (Match/Set/Game): Settled on the correct prediction of the final score in the match or specified period.",
      "Handicap Games (Match/Set): Determined by which player/team will win the match or set once the specified handicap is applied to the overall match or specified period score.",
      "Total Games Odd/Even (Match/Set): Determined by the total points scored in the match or specified period being either odd or even.",
      "Total Sets: Determined by whether the total number of sets played is over or under the specified line.",
      "Tiebreak Yes/No: Settled on whether a tiebreak takes place in any set during the match.",
      "Player To Win A Set: Settled on whether the named player wins at least one set during the match.",
      "Any Set To Nil: Settled on whether either player will win a set 6-0.",
      "Player/Team To Win + Total Games: Determined by the named player winning the game and scoring more or less total games than the taken line.",
      "Double Result (1st Set/Match): Settled as the winner of the first set along with the winner of the match.",
      "To come from behind: Determined on whether a player/team will be behind in set count but come back and win the match.",
      "Highest scoring set: Determined by which set has the greatest number of games played in it. Dead Heat rules apply.",
      "Xth Set – Race to X games: Settled as the player/team who first reaches the specified number of games in the given set.",
      "Xth Set – Xth Game - Break Point Yes/No: Determined by whether there is a break point in the game",
      "Xth Set – Xth Game – Result after 3rd Point: Determined by the exact score after the 3rd point in the given game is finished.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply).",
      "Stage of Elimination: Settled on the round a selected player is eliminated from the named competition.",
      "Winning Quarter/Group: Settled on which quarter / group of the tournament the winner of the tournament comes from.",
      "Winning Half: Settled on whether the tournament winner comes from the top or bottom half of the draw.",
      "To Reach The Final: Settled on whether the selected player reached the final of the tournament."
    ]
  },
  {
    "title": "Volleyball",
    "paragraphs": [
      "•\tAll markets are settled on the official result at the end of the scheduled regular time play unless otherwise stated.",
      "•\tAll games are scheduled to play regular format game rules. Should a different format be played such as number of sets, we reserve the right to void all affected bets.",
      "•\tIf a team refuses to play or is disqualified for any reason or a match does not complete 1 full set of play, all bets will be void if not already determined regardless of reason.",
      "•\tIn a fixture that is postponed or abandoned, all bets are void if the event is not resumed within 48 hours of the scheduled end of the match, unless an official winner is declared.",
      "•\tA Golden Set is not considered in any of the quoted markets unless stated.",
      "•\tOfficial points deductions will be taken into account for all undetermined markets. Markets which have already been determined will not take deductions into account."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Match/Set): The team which officially wins the match or specified period. In the event of a tie after regular time a golden set will be used as a decider, unless a draw option is given.",
      "Total Points (Match/Set):  The total number of points scored in the match or specified period. Bets settlement is determined on whether the result will be over or under the total line taken.",
      "Set Handicap Determined by which team will win the match once the specified handicap is applied to the final set score.",
      "Total Sets Determined by the number of sets played in the game.",
      "Correct Score (Match/Set):  Settled on the correct prediction of the final score in the specified period.",
      "Race to X Points (Match/Set): Settled on either the home team or away team being the first to score the specified number of points in the given period. Bets will be void if neither team scores enough points.",
      "Odd/Even (Match/Set):  Determined by the total points scored in the match or specified period being either odd or even.",
      "Xth Set – Xth Point: Settled as the team who scores the named point in the specified set.",
      "Exact Sets: Settled as the exact number of sets played once the match has finished.",
      "How Many Sets Will Be Decided By Extra Points: Determined by how many sets in the match will require additional points above the standard winning total.",
      "Event – Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Water Polo",
    "paragraphs": [
      "•\tAll bets are settled on regulation time unless otherwise stated.",
      "•\tIf an event is not completed, all unsettled markets will be void."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "1x2 (Match/Half/Quarter): Bets can be placed on a home win (1), a draw (x) or an away win (2). Settled on the winner of the match or specified period.",
      "Total goals (Match/Half/Quarter):  Settled on the total number of goals scored in the match will be over or under the specified line. If the result is the same as the line, the bet is classed as a push.",
      "Point Handicap (Match/Half/Quarter): Determined by which team will win the match or specified period once the specified handicap is applied to the result of the match or named period.",
      "Team Total goals (Match/Half/Quarter):  Settled on the total number of goals scored in the match by the selected team being over or under the specified line. If the result is the same as the line, the bet is classed as a push.",
      "Total Points Odd/Even (Match/Half/Quarter): Determined by the total points scored in the match or specified period being either odd or even.",
      "Next Team To Score (Match/Half/Quarter): Settled as the next team who scores a goal from the time the bet is struck.",
      "Event - Winner: The official classified winner of an event (Dead heat rules apply)."
    ]
  },
  {
    "title": "Winter Sports",
    "paragraphs": [
      "•\tGeneral betting rules apply to all outright and Head-to-Head markets",
      "•\tIf an event is taking place within a sporting tournament, e.g., Winter Olympics, all bets will stand even if the event is postponed as long as it is rescheduled to take place within the official time of the tournament",
      "•\tIf a single day event is postponed or abandoned, then bets remain valid provided that the event is completed within 48 hours."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Event - Winner: The official classified winner of an event (Dead heat rules apply).",
      "Head-to-Head & 3-way winner: All offered competitors must start the event. Bets void if one competitor does not participate. All rounds must be completed or bets are void. Dead heat rules apply in the event of a tie.",
      "Nationality of Winner: Nationality of the competitor or team in the stated event.",
      "Gold medal winner: Total gold medals leaderboard, the winner having the most gold medals. Any team events will count as one gold medal. In the event of a tie - Market will be settled off IOC medal table.   Esports",
      "Rules for esports disciplines are an addition to the general betting rules. In case of discrepancies or conflicts, specific points of the esports rules take precedence over general sports rules.",
      "The format of an esports match is determined by the regulations of the tournament organizer. A match can have a format consisting of one or several maps/games:",
      "•\tBest of 1 (Bo1) - A series of games up to 1 win.",
      "•\tBest of 2 (Bo2) - A series of 2 games (a draw is possible).",
      "•\tBest of 3 (Bo3) - A series of games up to 2 wins.",
      "•\tBest of 5 (Bo5) - A series of games up to 3 wins.",
      "•\tBest of 7 (Bo7) - A series of games up to 4 wins.",
      "•\tBest of 9 (Bo9) - A series of games up to 5 wins.",
      "According to tournament rules or the organizer's decision, a team may be given a map advantage before the game starts. Match in money line include a note regarding the format's specifics, and the default map is considered as if it were actually played.",
      "For all markets where overtime is considered in the settlement, the market name contains incl. overtime. All other markets will be settled on the result of regular time only.",
      "The final result for sports such as Dota 2, League of Legends, Wild Rift, King of Glory, etc., is based on the data recorded immediately after the destruction of the main building (Throne/Fortress/Nexus) of one of the opponents. Similarly, the calculation is made if one of the teams surrenders Throne/Fortress/Nexus is not destroyed directly by the opponent in this case). Victory is awarded to the surrendering team's opponent."
    ]
  },
  {
    "title": "Refund of bets",
    "paragraphs": [
      "Unsettled bets are refunded if the match is postponed for more than 48 hours from the scheduled start time. If the match is delayed by more than 48 hours after the start, bets on outcomes that have already occurred (e.g., round winner or first kill) remain valid and settled.",
      "If the match is delayed for 48 hours or less after the start, the following rules apply:",
      "•\tResumption from the current score or specific moment/time on the map. All bets remain valid and will be settled based on the final result of the match.",
      "•\tReplay (restart). All bets for which the outcome was determined at the time of interruption remain valid. All unsettled bets will be refunded. Replayed maps or matches will be considered as a new match.",
      "In case of a change in the planned number of maps, bets on the match winner, total maps, correct map score, map handicap, and total maps odd/even will be refunded. Bets on map markets will be settled according to the final score of the specified map.",
      "If one of the teams (players) does not continue the match or match period, bets are calculated as follows:",
      "•\tBets on map winner (if started but not completed) and match winner will be settled according to the official result;",
      "•\tBets on markets and outcomes where the result has been determined will be settled according to that result (including handicap on maps, correct map score, total and even/odd number of maps)."
    ]
  },
  {
    "title": "Example 1",
    "paragraphs": [
      "A bet on total maps over 2.5 in a bo3 match will be settled if the withdrawal occurred with a score of 1:1 on maps and refunded if the score was 1:0, 0:1 or 0:0;"
    ]
  },
  {
    "title": "Example 2",
    "paragraphs": [
      "A bet on a Map handicap -1.5/+1.5 will be settled if any team loses or wins the required number of maps for the market to be considered settled (example, 1:0 on maps in a bo3 match will mean a loss for a Map handicap -1.5 for Team2). If a withdrawal occurred with a map score that does not allow the outcome to be determined, bets will be refunded (example, 1:0 on maps in a bo3 match for a bet on the Map handicap -1.5 for Team1;",
      "•\tFor all cases, bets on markets whose outcome has not been determined will be refunded. If the map has not started, then all results of this map (including map winner) will be refunded.",
      "The rules apply if the reason for technical defeat/withdrawal/forfeit is not the disqualification of the team, when the settlement of bets is made on the basis of a separate section of the rules.",
      "If a disqualification is awarded by the organizer after the completion of a map/game due to the team/player gaining an advantage through:",
      "•\tUse of forbidden tools (aimbots, snap tap, cheats);",
      "•\tExploiting game bugs;",
      "•\tCheating, match-fixing;",
      "•\tOther actions that undermine the fairness of the game.",
      "all bets, or bets on map markets, will be refunded depending on the type of punishment imposed on the team.",
      "Bets are not refunded due to technical defeat after the end of the match in the following cases:",
      "•\tViolation of the tournament rules, principles of fair play, sports ethics;",
      "•\tDisqualification of a team or player due to an unsportsmanlike element;",
      "•\tParticipation of an ineligible player (age restrictions, citizenship, etc.), but excluding use by the team a ringer/faker - different player on the account);.",
      "•\tReplay of the tournament bracket due to disqualification of any team.",
      "Bets are also not refunded in the following cases:",
      "•\tGrammatical errors in team or tournament names;",
      "•\tSubstitutions in team lineups before and during the match (excluding changing its lineup by more than 50%);",
      "•\tChanging the team name without changing its lineup by more than 50%;",
      "•\tReplaying a round;",
      "•\tPlaying with unequal lineups."
    ]
  },
  {
    "title": "Fixed Matches, Unsportsmanlike Conduct",
    "paragraphs": [
      "If there are signs of unsportsmanlike conduct or a fixed match, the Company, at its discretion and without the match organizer's acknowledgment of a breach of sporting principles, reserves the right to:",
      "•\tSuspend the settlement of bets for up to 72 hours;",
      "•\tDecide to refund bets if there are signs of unsportsmanlike conduct.",
      "The Company will base its decision on evidence of unsportsmanlike conduct or a fixed match from its own sources. The Company does not provide gamblers with evidence of a breach of sporting principles in a suspicious match."
    ]
  },
  {
    "title": "Main Markets",
    "paragraphs": [
      "Winner: A bet on the winner of the match.",
      "1x2: A bet on the winner of the match considering a draw. Offered in matches where a draw is possible (e.g., in a bo2 series).",
      "Double Chance: A bet on two out of three possible outcomes in matches in best of 2 format (1X, X2, 12).",
      "Map No. - Winner: A bet on the winner of the specified map in the match.",
      "Total Maps: A bet on the total number of maps played within the match.",
      "Map Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing maps.",
      "Correct map score: A bet on the exact final score in the match by maps.",
      "Odd/Even Total Maps: A bet on the even or odd number of maps in the match."
    ]
  },
  {
    "title": "Player Markets",
    "paragraphs": [
      "Player markets are calculated in accordance with internal data and, if necessary, are confirmed on the specified sites or video broadcasts:",
      "•\tCounter-Strike - hltv.org",
      "•\tDOTA2 - dotabuff.com",
      "•\tValorant - vlr.gg",
      "•\tLeague of Legends - gol.gg",
      "If a player is replaced before and after the start of the match, bets on all unsettled outcomes with his participation will be refunded."
    ]
  },
  {
    "title": "Counter-Strike",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime or regular time depending on the name of the market;",
      "•\tOvertime. Victory on the map is achieved by winning at least 13 rounds. In a tie situation on the map (when the score is 12:12 by rounds, tournaments usually provide for 6 additional rounds, the so-called \"overtime\"). Victory in overtime is awarded to the team that first wins 4 out of 6 additional rounds. If overtime ends in a draw (both teams have won 3 rounds each), another overtime (6 additional rounds) is scheduled."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Total Rounds: A bet on the total number of rounds played by both teams within the match.",
      "Round Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the match.",
      "Match - Team X total rounds - A bet on whether Team N wins more or fewer than the specified number of rounds on the specified match.",
      "Map No. - First Half - 1x2: A bet on a team to win the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 7 rounds. For matches in the MR15 format, a market First Half - Winner is offered without taking into account a draw.",
      "Map No. - Second Half - 1x2 : A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The start of the second half is the 13th round (or 16th for the MR15 format). The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First Half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - Second Half correct score: A bet on the exact score by rounds on the second half on the specified map. Map No. - First half  - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map. Map No. - Second half  - Round handicap: A bet on the Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First half  - Team X Total rounds: A bet on the total number of rounds won by the specified team on the first half on the specified map.",
      "Map No. - Second half - Team X Total rounds: A bet on the total number of rounds won by the specified team in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Second half - Total rounds: A bet on the total number of rounds played in the second half on the specified map .The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Odd/Even number of rounds: A bet on the odd or even number of rounds played on the specified map.",
      "Map No. -  Will there be overtime?: A bet on whether there will be overtime on the specified map.",
      "Map No. - Will there be a Team kill?: A bet on whether there will be a Team Kill from the selected team on the specified map. Team Kill refers to a player \"killing\" their teammate.",
      "Map No. - Will there be a knife kill?: A bet on whether there will be a kill by knife from the selected team on the specified map.",
      "Map No. - Will ACE be in round No.?: A bet that a player will make 5 kills (kill the entire opposing team) in the selected pistol round on the specified map.",
      "Map No. - Will there be a Zeus X27 kill?: A bet on whether there will be a kill by Zeus X27 on the specified map.",
      "Map No. - Pistol round No. winner: A bet on which team will win the selected pistol round on the specified map.",
      "Map No. - Both pistol rounds winner: A bet on which team will win both pistol rounds on the specified map.",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team within the match.",
      "Example: a player bets on more than 21.5 for Team #2, and in a bo3 match, the mentioned team loses with scores of 13-11; 13-10. The total number of rounds won by Team #2 = 21 (11+10) - the bet loses because the number of rounds won is less than the total value. Conversely, if the bet was placed on less than 21.5 with a total of 21 rounds won in the match, it wins.",
      "Team X - Total pistol round wins: A bet on whether the specified team wins the chosen number of pistol rounds in the match.",
      "Map No. - Correct pistol rounds score: A bet on the exact score by pistol rounds (1st and 13th) on the specified map..",
      "Map No. - Total rounds: A bet on the total number of rounds within the map. For example, if a player bets on over 22.5 and there are a total of 20 rounds played on the map, the bet loses because the total number of rounds played is less than the total value. If the bet was placed on under 22.5 with 22 rounds played, it will be settled as a win.",
      "Map No. - Total rounds (3 way): A bet on the total number of rounds played in the map, with three possible outcomes: under a specified number of rounds, over a specified number of rounds, or exactly a specified number of rounds.",
      "Map No. - Team X - total rounds: A bet on the number of rounds won by the team on the specified map (over or under).",
      "Map No. - Team X - total rounds as Terrorists/Counter-Terrorists: A bet on the number of rounds won by the team on the specified map (over or under) while playing on the specified side: Terrorists or CT (Counter-Terrorists).",
      "Map No. - Total bomb explosion: A bet on the total number of rounds within the specified map that ended with a bomb explosion.",
      "Map No. - Total kills in pistol rounds: A bet on the total number of kills from both teams in the selected pistol round on the specified map.",
      "Map No. - Round Handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map.",
      "Map No. - Round handicap (3 way): A bet on which team will win a specific round with a handicap, offering three possible outcomes: Team 1 wins with the handicap, Team 2 wins with the handicap, or a tie considering the handicap.",
      "Map No. - Asian total rounds: Asian total rounds involve betting on the total number of rounds played in a match using fractional values such as 20.25, 20.75, etc. These bets are divided into two parts, allowing for partial returns or partial losses. Examples:",
      "•If a bet on over 20.25 total rounds and 21 rounds and more are played, both halves of bet win. If 20 rounds are played, half of bet (on 20) is refunded, and the other half (on 20.5) loses;",
      "•If a bet on over 20.75 total rounds and 21 rounds are played, half of bet (on 20.5) wins, and the other half (on 21) is refunded. If 22 rounds and more are played, both halves of bet win.",
      "Map No. – Asian round handicap: is a type of bet used to balance the odds between two teams or players by adding or subtracting a certain number of rounds from their final score. When using quarter handicaps (e.g., -0.25 or +0.75), the bet is split into two parts: one with the nearest whole number, the other with the nearest half number, reducing the risk of a full loss.",
      "Map No. - Round No. Winner: A bet on a team to win a selected round on a specified map.",
      "Map No. - Race to rounds: A bet on which of the teams will first win the selected number of rounds on the specified map.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 12:12 (15:15 for MR15), all outcomes are settled as losses.",
      "Map No. - Round X - Method of victory: A bet on the method of victory of any of the teams in the selected round on the specified map. Victory in the round is achieved by one of the possible methods: opponent eliminated, bomb explosion/defusal, or expiration of round time without the bomb being planted.",
      "Map No. - 1x2 of Nth overtime: A bet on the winner of the selected overtime of the specified map, a draw is considered as an option.",
      "Map No. - Overtime No. - Round handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified оvertime.",
      "Map No. - Overtime No. - Correct Score: A bet on the exact score by rounds in the specified overtime on the specified map",
      "Map No. - Overtime No. - Odd/Even number of rounds: A bet on the odd or even number of rounds in the specified overtime on the specified map.",
      "Map No. - Overtime No. - Total rounds: A bet on the total number of rounds played in specified overtime on the specified map.",
      "Map No. - Overtime No. - First half - Winner: A bet on the team that will win two rounds first in specified overtime on the specified map.",
      "Map No. - Total Under + Win: A bet on which team will win the map and the total number of rounds played will be less than a certain total value.",
      "Map No. - Total over + Win: A bet on which team will win the map and the total number of rounds played will be greater than a certain total value.",
      "Map No. - Winning margin: A bet on the team's victory within a certain range of rounds. Team victory on the specified map with a margin of rounds within the selected range after the map ends. Example: Team A wins 13-7. The winning margin for this result is 5-7 rounds.",
      "Map No. - Will there be a Molotov (Incendiary Grenade) kill: A bet on whether there will be a kill by Incendiary Grenade by any of the teams on the specified map. If someone will kill his enemy by Grenade but not by fire this outcome will be settled as “yes”. Map No. – Will there be HE Grenade kill: A bet on whether there will be a kill by HE Grenade from any of the teams on the specified map. If someone will kill his enemy by Grenade but not by fire this outcome will be settled as “yes”.",
      "Map No. - Player X - Total Kills: A bet on the total number of kills by Player N on the specified map. Map No. - Player X - Total Deaths: A bet on the total number of deaths by Player N on the specified map (incl. death as a result of team kill, suicide and bomb explosion).",
      "Map No. - Round X - Total Kills: A bet on the total number of kills by both teams in round. Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies) in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map. Map No. - First kill in round: A bet on the team that will make the first kill (entry frag) in the specified round.",
      "Map No. - Team X total kills in the round: A bet on the total number of enemy kills from team N in the selected round on the specified map.",
      "Map No. - Duel of players - Winner by kills: A bet on comparing players by the number of kills made on the specified map. In the event of an equal number of kills, bets on the market will be refunded.",
      "Map No. - Duel of players - 1X2 by kills provides for a bet on comparing taking into account a draw.",
      "Map No. - Duel of players - Handicap by kills: A bet on the outcome of a duel between two players with a handicap applied based on the number of kills.",
      "Map No. - Win First Half + Win Map: A bet on a team to win the first half and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win Map: A bet on a team to win the first pistol round and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win First Half: A bet on a team to win the first pistol round and the first half of the specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Odd/Even number of kills: A bet on the total even or odd number of kills on the specified map.",
      "Map No. - Total kills: A bet on the total number of kills on the specified map.",
      "Map No. - Total deaths: A bet on the total number of deaths on the specified map (incl. death as a result of team kill, suicide and bomb explosion).",
      "Map No. - Round No. - Total Kills by Player X: A bet on the total number of enemy kills from player N in the selected round on the specified map.",
      "Map No. - Round No. - Will the Player X die: A bet on the player's N death in the selected round on the specified map.",
      "Map No. - Round No. - Player X make a kill: A bet on the one and more kills by Player N in the selected round on the specified map.",
      "Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies) in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map.",
      "Map No. - Round N - Will Ace be in the round?: A bet on whether any player kills the whole enemy team in the specified round of the map.",
      "Map No. - Total headshots: A bet on the total number of headshots (kills in head) on the specified map."
    ]
  },
  {
    "title": "Dota 2",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: Bet on the number of kills made by both teams on the specified map. The final value of the team's kill counter (count near the timer) is taken into account, not kills or deaths of heroes in the teams.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - Winner + Total Kills / Map No. - Winner + Duration: A bet on the team's victory on the map considering the total kills and duration.",
      "Map No. - Total Kills Odd/Even: A bet on the even or odd number of kills made by both teams within the specified map, without considering finishing off with neutral creeps, allies, suicides, etc.",
      "Map No. - First Blood: A bet on the first kill on the specified map, without considering finishing off with neutral creeps, allies, suicides, etc.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map. The final value of the team's kill counter (count near the timer) is taken into account, not kills or deaths of heroes in the teams.",
      "Map No. - Race to Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - Kill Maker: A bet on which team will achieve the next kill. The kill count is based on the total number of kills.",
      "Map No. - Kills handicap: A bet on the advantage or disadvantage of one of the teams, expressed in the number of team kills on the specified map. Match - Total Kills: A bet on the number of kills made by two teams during the match. Match - Handicap kills: A bet on the advantage or disadvantage of one of the teams, expressed in the number of kills of each team during the entire match. Match - Team X Total Kills: A bet on the number of kills made by one of the teams during the match. Map No. - Intervals: Total Kills on minute: A bet on the number of kills in a certain range of minutes. Map No. - Will there be a kill at a specific interval of time: A bet on whether there will be a kill within a certain time interval.",
      "Map No. - First Roshan Kill: A bet on the team that will kill Roshan first on the specified map.",
      "Map No. -Total Roshans slain: Bet on the total number of Roshan kills on the specified map (over/under).",
      "Map No. - Both teams kill Roshan: A bet on both teams killing Roshan within the game time on the specified map. Map No. - Winner by Roshan kills: A bet on which of the two teams will kill more Roshans. Map No. - 1x2 by Roshan kills: A bet on which of the two teams will kill more Roshans with a draw.",
      "Map No. - Total Towers destroyed: A bet on the total number of towers destroyed on the specified map",
      "Map No. - Team X Total Towers destroyed: A bet on the number of destroyed towers of one of the teams on the specified map.",
      "Map No. - First Tower destroyed: A bet on which of the teams will destroy the opponent's first tower on the specified map. The loss is credited to the team whose first tower was destroyed earlier than the opponent's, even if the tower is destroyed by their own hand.",
      "Map No. - Towers Handicap: A bet on the advantage or disadvantage of one of the teams, expressed in the number of destroyed towers. Map No. - First Tier 3 Tower Destroy location: A bet on which line the teams will destroy the first tier 3 tower. Map No. - Winner by destroyed towers: A bet on the winner of the map, which team will destroy more towers. Map No. - 1x2 by destroyed towers: A bet on the winner of the map, which team will destroy more towers with a draw.",
      "Map No. - First barrack: A bet on the team that will destroy the barracks first.",
      "Map No. - Both teams will destroy barracks: A bet on both teams destroying all barracks within the in-game timer on the specified map.",
      "Map No. - Total barracks: A bet on the total number of barracks destroyed on the map.",
      "Match - Total barracks: A bet on the total number of barracks destroyed in the match.",
      "Map No. - Ultra Kill: A bet on a series of 4 kills on the specified map. The bet is considered played if an ultra kill is shown/announced in the game. Fixation occurs according to the in-game timer.",
      "Map No. - Rampage: A bet that there will be a series of 5 kills on the specified map. Fixation is based on in-game timer, and is considered played if a Rampage is shown/announced in the game.",
      "Map No. - Godlike: A bet that one of the players will make a series of 9 or more kills of enemy heroes without being killed.",
      "Map No. - Both teams will destroy Barracks: A bet on both teams destroying all barracks within the game time on the specified map.",
      "Map No. - Both teams will kill Roshan: A bet on both teams killing Roshan within the game time on the specified map.",
      "Map No. - Mega Creeps spawned: A bet on one of the teams destroying all enemy barracks in the game, even if mega creeps have not yet appeared.",
      "Map No. - Active Rune will appear at a specific minute on the top or bot side: A bet on whether a rune at a specific minute will appear on the top (upper part of the map) or bot (lower part of the map) side.",
      "Map No. - Kill First Courier: A bet on which of the teams will kill the enemy courier. The bet is considered played after one of the teams kills the enemy courier. If there is no courier kill during the map, the bet will be refunded.",
      "Map No. - Aegis of the Immortal to be snatched: A bet that Aegis of the Immortal will be stolen on the specified map. The condition for winning is if one team kills Roshan, but the Aegis of the Immortal artifact is picked up by a player from the opposite team.",
      "Map No. - Divine Rapier: A bet on one of the players purchasing the Divine Rapier artifact during the map.",
      "Map No. - Kill first tormentor: A bet on which team will kill Tormentor first on the specified map.",
      "Map No. - One of the teams will lead in gold until a specific minute: A bet on which of the teams will lead in gold up to a certain time. The time is counted according to the in-game timer. For example, Team #1 leads in gold at the 10th minute of the map with 2,000 gold, indicating an economic advantage over Team #2, after which the bet is considered played.",
      "Who will achieve more Roshan kills, tower destructions (separate markets available, including draws): A bet on the victory in the race of kills or object destructions on the map.",
      "For example: Team #1 destroyed 4 towers, and Team #2 destroyed 12 towers, in this case, the bet on Team #2's victory is considered successful. Similarly for Roshans.",
      "Map No. - First buyback: A bet on the team whose player will be the first to use the buyback option on the specified map.",
      "Map No. - Total buybacks: A bet on the number of buybacks made by both teams on the specified map.",
      "Map No. - The game will end at day/night?: A bet on what in-game cycle map will be ended.",
      "Map No. - Which team`s player will be the first to reach lvl 6: A bet on the team whose player will be the first to reach level 6 on the specified map",
      "Map No. - Specials markets: A bet on a combination of two outcomes that will occur on the specified map. A bet wins if both outcomes are settled as win."
    ]
  },
  {
    "title": "Valorant",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime or regular time depending on the name of the market;",
      "•\tOvertime: Victory on the map is achieved by winning at least 13 rounds. In a tie situation on the map (when the round score is 12:12), the tournament regulations usually provide for 2 additional rounds. Each team plays one round as Attackers and one round as Defenders. Victory in overtime is awarded to the team that wins both additional rounds. If overtime ends in a draw (both teams win 1 round each), another overtime is scheduled (2 additional rounds).",
      "•\tIn random matches, bets on the winner of the map/match will be refunded if the players of the teams decide to end in a draw based on the results of the vote."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - First Half - 1x2: А bet on the winner of the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 7 rounds.",
      "Map No. - Second half - 1x2: A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The start of the second half is the 13th round. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Odd/Even number of rounds: A bet on the odd or even number of rounds played on the specified map.",
      "Map No. - Will there be overtime: A bet on whether there will be overtime on the specified map.",
      "Map No. - Pistol round N winner: A bet on which team will win the selected pistol round on the specified map. Map No. - Total kills in pistol rounds: A bet on the total number of kills from both teams in the selected pistol round on the specified map. Map No. - Win First pistol round + Win map: A bet on a team to win the first pistol round and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win First half: A bet on a team to win the first pistol round and the first half of the specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Total rounds: A bet on the total number of rounds on the specified map.",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team in the match.",
      "Map No. - Team X total rounds: A bet on the total number of rounds won by the specified team on the specified map.",
      "Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total number of winning or losing rounds in the match.",
      "Map No. - Round handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map..",
      "Map No. - Race to rounds: A bet on which team will win the selected number of rounds on the specified map first.",
      "Map No. - Asian total rounds: Asian total rounds involve betting on the total number of rounds played in a match using fractional values such as 20.25, 20.75, etc. These bets are divided into two parts, allowing for partial returns or partial losses. Examples:",
      "•\tIf a bet on over 20.25 total rounds and 21 rounds and more are played, both halves of bet win. If 20 rounds are played, half of bet (on 20) is refunded, and the other half (on 20.5) loses;",
      "•\tIf a bet on over 20.75 total rounds and 21 rounds are played, half of bet (on 20.5) wins, and the other half (on 21) is refunded. If 22 rounds and more are played, both halves of bet win.",
      "Map No. – Asian round handicap: is a type of bet used to balance the odds between two teams or players by adding or subtracting a certain number of rounds from their final score. When using quarter handicaps (e.g., -0.25 or +0.75), the bet is split into two parts: one with the nearest whole number, the other with the nearest half number, reducing the risk of a full loss. Map No. - Round handicap (3 way): A bet on which team will win a specific round with a handicap, offering three possible outcomes: Team A wins with the handicap, Team B wins with the handicap, or a tie considering the handicap. Map No. - Total Rounds (3 way): A bet on the total number of rounds played in the map, with three possible outcomes: under a specified number of rounds, over a specified number of rounds, or exactly a specified number of rounds.",
      "Map No. - First kill in round: A bet on the team that will make the first kill in the selected round.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 12:12, all outcomes are settled as losses.",
      "Map No. - Correct pistol rounds score: A bet on the exact score by pistol rounds (1st and 13th) on the specified map.",
      "Map No. - Total rounds + Win map: A bet on the total rounds and victory of the team on the specified map.",
      "Map No. - First half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - Second half correct score: A bet on the exact score by rounds on the second half on the specified map.",
      "Map No. - Will ACE be in round No.?: A bet that a player will make 5 kills (kill the entire opposing team) in the selected pistol round on the specified map.",
      "Map No. - Win First half + Win map: A bet on a team to win the first half and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - First half - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map. Map No. - Second half - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the second half on the specified map.The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First half - Team X Total rounds: A bet on the total number of rounds won by the specified team (Team N) in the first half on the specified map.",
      "Map No. - Second half - Team X Total rounds: A bet on the total number of rounds won by the specified team in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Second half - Total rounds: A bet on the total number of rounds played in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Defenders total rounds: A bet on the total number of rounds the defending side will take on the specified map.",
      "Map No. - Attackers total rounds: A bet on the total number of rounds the attacking side will take on the specified map.",
      "Map No. - Winning margin: A bet on the team's victory within a certain range of rounds. Team victory on the specified map with a margin of rounds within the selected range after the map ends. Example: Team A wins 13-7. The winning margin for this result is 5-7 rounds.",
      "If overtime is required to determine the winner of the map, only winning margin 2-4 for the selected team is considered a winner.",
      "Map No. - Round No. - Method of victory: A bet on the method of victory of any of the teams in the selected round on the specified map. Victory in the round is achieved by one of the possible methods: opponent eliminated, bomb explosion/defusal, or expiration of round time without the bomb being planted.",
      "Map No. – Round No. Winner: A bet on a team to win a selected round on a specified map.",
      "Map No. - Round No. - Spike (Bomb) planted: A bet on whether the Spike (Bomb) will be planted in the selected round on the specified map.",
      "Map No. - Round No. – Total Kills: A bet on the total number of kills in the selected round on the specified map.",
      "Map No. - Round No. - Team X Total Kills: A bet on the total number of kills by Team X in the selected round on the specified map.",
      "Map No. - Total kills by player - A bet on the total number of kills by Player X on the specified map.",
      "Map No. - Total deaths by player - A bet on the total number of deaths by Player X on the specified map.",
      "Map No. - 1x2 of overtime No.: A bet on the winner of the selected overtime of the specified map with a draw. Map No. - Overtime No. - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified оvertime.",
      "Map No. - Overtime No. - Correct Score: A bet on the exact score in the specified overtime on the specified map",
      "Map No. - Overtime No. - Odd/Even number of rounds: A bet on the odd or even number of rounds in the specified overtime on the specified map.",
      "Map No. - Overtime No. - Total Rounds: A bet on the total number of rounds played in specified overtime on the specified map.",
      "Map No. - Total under + win: A bet on which team will win the map and the total number of rounds played will be less than a certain total value.",
      "Map No. - Total over + win: A bet on which team will win the map in and the total number of rounds played will be greater than a certain total value.",
      "Map No. - Player X total kills in the round: A bet on the total number of enemy kills from player N in the selected round on the specified map.",
      "Map No. - Round No. - Will be the Player X die: A bet on the player's N death in the selected round on the specified map.",
      "Map No. - Round No. - Player X make a kill: A bet on the one and more kills by Player N in the selected round on the specified map.",
      "Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies)in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map.",
      "Map No. - Round No. - Will Ace be in the round?: A bet on whether any player kills the whole enemy team in the specified round of the map.",
      "Map No. - Duel of players - Winner by kills: A bet on comparing players by the number of kills made on the specified map. In the event of an equal number of kills, bets on the market will be refunded.",
      "The market Map No. - Duel of players - 1X2 by kills provides for a bet on comparing taking into account a draw. Map No. - Duel of players - Handicap by kills: A bet on the outcome of a duel between two players with a handicap applied based on the number of kills",
      "Map No. - Total headshots: A bet on the total number of headshots (kills in head) on the specified map."
    ]
  },
  {
    "title": "League of Legends, Wild Rift",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. – Total Kills: A bet on the total number of kills made within one map. All kills made before the end of the match are considered, including kills after \"GG\" is typed in the general chat. The calculation is based on the final score of the teams in post-match statistics, meaning the bet does not account for deaths that are not credited to the opposing team - friendly unit kills, neutral creeps, suicides by abilities or items, etc. The team's kill count may differ from the total kill or death count on teams, such as when a hero dies to enemy creeps or towers, the kill is not credited to the enemy heroes but counted as a death for the player and is not considered in the calculation of the consequences of the total kills and odd/even number of kills on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - Kills Total Odd/Even: A bet on the odd or even total number of kills made by both teams within the specified map, excluding neutral kills, suicides, etc.",
      "Map No. – Race to X Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First blood: A bet on which team will make the first kill on the specified map, excluding neutral kills, suicides, etc.",
      "Map No. - First dragon: A bet on which team will achieve the first Dragon kill on the specified map.",
      "Map No. - First tower: A bet on which team will destroy the first enemy tower on the specified map.",
      "Map No. - First Baron: A bet on which team will achieve the first Baron kill on the specified map.",
      "Map No. - First inhibitor: A bet on which team will destroy the first inhibitor on the specified map.",
      "Map No. - Total dragons slain: A bet on the total number of Dragon kills by both teams on the specified map.",
      "Map No. - Towers total: A bet on the total number of destroyed towers by both teams on the specified map.",
      "Map No. - Total barons slain: A bet on the total number of Baron kills by both teams on the specified map.",
      "Map No. - Total Inhibitors destroyed: A bet on the total number of destroyed inhibitors by both teams on the specified map.",
      "Map No. - First Herald: A bet on which team will kill the Herald first on the specified map.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. - First Dragon type: A bet on the type of the first killed Dragon on the specified map.",
      "Match - Team X Total Kills: A bet on the number of kills made by one of the teams during the match.",
      "Map No. - Winner + Kills Total: A bet on the total kills and the victory of the team on the specified map.",
      "Map No. - Winner + Total kills odd/even: A bet on the winner and the odd/even kills total on the specified map.",
      "Map No. - Triple Kill: A bet that a player will kill three champions within 10 seconds of each other on the specified map.",
      "Map No. - Quadra Kill: A bet that a player will kill four champions within 10 seconds of each other on the specified map.",
      "Map No. - Team to kill first Scuttler: A bet on which team will kill the scuttler first.",
      "Map No. - Herald will be killed before 10 minutes: A bet on whether any team will kill the Herald before 10:00 min on the in-game timer on the specified map.",
      "Map No. - Both teams will kill Herald: A bet on whether both teams will kill the Herald on the specified map.",
      "Map No. - Both teams killed first 2 dragons: A bet on whether both teams will kill the first two dragons on the specified map.",
      "Map No. - Dragon steal: A bet on whether one of the teams on the specified map will steal the Dragon that the opposing team failed to kill.",
      "Map No. - Dragon Soul: A bet on whether the Dragon Soul will be taken on the specified map (killing 4 Dragons for one of the teams grants the Dragon Soul).",
      "Map No. - Baron steal: A bet on whether one of the teams on the specified map will steal the Baron that the opposing team failed to kill.",
      "Map No. - Last killed champion role: A bet on the role of the Champion killed last on the specified map.",
      "Map No. - Total kills before 10 minutes: A bet on the total number of kills made before 10 minutes, counted by the in-game timer.",
      "Map No. - Champion role with the most kills: A bet on which champion role will make the most kills on the specified map.",
      "Map No. - Which role to draw First Blood: A bet on which role will achieve the First Blood.",
      "Map No. - Which role will be killed first: A bet on which role will die at First Blood.",
      "Map No. - Total ACE: The total number of aces on the specified map (An ace is defined as killing the last living champion of the enemy team).",
      "Map No. - First tower destroyed location: A bet on which part of the map the first tower will be destroyed (bottom, middle, or top lane).",
      "Map No. - First Inhibitor destroyed location: A bet on which part of the map the first inhibitor will be destroyed (bottom, middle, or top lane).",
      "Map No. - Inhibitor respawn: A bet on whether the inhibitor will respawn on the specified map.",
      "Map No. - First tower destroyed within 13 minutes: A bet on whether the first tower will be destroyed before 13:00 min on the in-game timer on the specified map.",
      "Map No. - Elder Dragon to be slayed: A bet on whether there will be an Elder Dragon kill on the specified map.",
      "Map No. - Dragon kill handicap: The advantage or disadvantage of one of the teams, expressed in the number of dragon kills on the specified map.",
      "Map No. -Total destroyed towers odd/even: A bet on the odd or even total number of destroyed towers by both teams on the specified map",
      "Map No. - Slain the second Dragon: A bet on which team will kill the second dragon on the specified map.",
      "Map No. - Player X - Total Kills: A bet on the total number of kills by Player X on the specified map. Map No. - Player x - Total Deaths: A bet on the total number of kills by Player X on the specified map..",
      "Map No. - Baron type: A bet on which type of Baron will appear on the specified map. If the game ends before the 20:00 min on the in-game timer, the bet will be refunded.",
      "Map No. - Which team’s player will be the first to reach lvl 6: A bet on which player from which team will be the first to reach level 6 on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total kills: A bet on the total number of kills on the specified map. All kills made before the end of the match are counted, including kills after \"GG\" is typed in the general chat. Calculation is based on the final team score in the post-match statistics, so the bet does not count deaths that are not credited to the opposing team.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 min and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - First blood: A bet on which team will make the first kill on the specified map, excluding neutral kills, suicides, etc.",
      "Map No. - Race to  Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First tower: A bet on which team will destroy the first enemy tower on the specified map."
    ]
  },
  {
    "title": "Overwatch",
    "paragraphs": [
      "Map No. - Total points scored: A bet on the number of points by both teams on the specified map"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No./Game No. - Winner: A bet on the victory of the team on the map assumes the first place occupied by the team on the specified map or game.",
      "Map No. - Team 1 will be higher in the grid than Team 2: A bet that team 1 will rank higher than team 2 on the specified map (without taking into account the number of kills).",
      "Map No. – Team X will enter the top (Yes/No): A bet on the final place of the team - above or exact (Yes) / below (No) in the specified game. Game No. - Total kills: A bet on the number of kills made by both players/teams in the specified game.",
      "Game No. - Total kills odd/even:  A bet on the odd or even number of kills made by both teams on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No.  – Will player get top (Yes/No):  A bet on a player's final place - above or exact (Yes) / below (No) in the specified game. Game No. – Total Kills: A bet on whether Player/Team N will achieve the specified number of kills – over or under in the specified game. Game No. – Odd/Even Number of Kills: A bet on the odd or even number of kills made by player in the specified game.",
      "Game No. – Winning Margin by Top/Kills: A bet on the range of values for top/kills achieved by the player/team in the specified game. Game No. – Will the Player make a Kill: A bet on whether the player will make a kill in the specified game.",
      "Game No. - Winner: A bet on the winner of the specified map.",
      "Total kills for first 5, 10 games: A bet number of kills made by Player on the specified intervals."
    ]
  },
  {
    "title": "Apex Legends",
    "paragraphs": [
      "•\tRecording of the game ending, as a clip on Twitch can be obtained upon request.",
      "•\tIn cases where the streamer exits the game through the game menu before landing on the surface, bets remain valid for the next game.",
      "•\tIf circumstances arise under which the result of the match is unknown, all bets on events for which the result has occurred up to that point will be settled according to the available results at the end of the game. All other bets will be refunded.",
      "•\tIf the streamer changes the game mode, all bets made before landing on the surface will be refunded.",
      "•\tThe company is not responsible for any actions of the streamer, bugs, or software errors in the game that affect the result.",
      "•\tIn case of stream sniping by the streamer, the company reserves the right to refund all bets on the specified game."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No.  – Will squad get top (Yes/No): A bet on the final place of the squad - above or exact (Yes) / below (No) in the specified game. Game No. – Odd/Even Number of Kills: A bet on whether the number of kills - odd or even in the specified game. Game No. – Winning Margin by Top/Kills: A bet on the range of values for top/kills achieved by the player/team in the specified game. Game No. – Will player make a kill: A bet on whether the player will make a kill in the specified game.",
      "Game No. - Will player make an assist: A bet on whether the player will make an assist in the specified game.",
      "Game No. – Total Kills: A bet on whether a player/team will achieve the specified number of kills – over or under in the specified game. Game No. – Total Assists: A bet on whether a player/team will achieve the specified number of assists – over or under in the specified game."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss."
    ]
  },
  {
    "title": "Hearthstone",
    "paragraphs": [
      "Ranked Mode:",
      "Game No. - Winner: A bet on the winner of the game with the specified sequence number. Game No. - Total Moves: A bet on the total number of moves between players in the respective game until its end. Win rate for the first 10 games: A bet on whether the player will win more or less than 50% of the games in the first 10 played.",
      "Battlefield Mode:  Game No. - Will player get top (yes/no): A bet on a player's final place - above or exact (Yes) / below (No) in the specified game."
    ]
  },
  {
    "title": "King of Glory/ Arena of Valor",
    "paragraphs": [
      "Calculation is made according to the final score in post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: A bet on the number of kills made by both teams on the specified map.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - First Tower destroyed: A bet on which team will destroy the first tower on the specified map.",
      "Map No. - Total Towers destroyed: A bet on the total number of towers destroyed on the specified map",
      "Map No. - Team X Total Towers Destroyed: A bet on the number of destroyed towers of one of the teams on the specified map.",
      "Map No. - Kills handicap: The advantage or disadvantage of one of the teams, expressed in the number of team kills on the specified map.",
      "Map No. - Race to Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First Blood: A bet on which team will draw first blood on the specified map.",
      "Map No. - Triple Kill: A bet on whether a triple kill will be performed consecutively by one hero on the specified map.",
      "Map No. - Individual Highest total kills: A bet on whether a player will make the highest individual kills on the specified map.",
      "Map No. - First Blood total assists: A bet on the number of assists during the first blood on the specified map.",
      "Map No. - First Pick Hero position: A bet on the position of the first hero chosen during the draft on the specified map: Jungle, Farm Line, Hard Line, Mid Lane, Support.",
      "Map No. - First Spell Choice during Draft: A bet on the first hero's spell choice during the draft on the specified map - Flash or other.",
      "Map No. - Total number of flash carried: A bet on the number of flashes used by heroes on the specified map.",
      "Map No. - Slay the first Tyrant: A bet on which team will kill the first Tyrant on the specified map.",
      "Map No. - Slay the first  shadow Tyrant: A bet on which team will kill the first Shadow Tyrant on the specified map.",
      "Map No. - Slay the first Lord of Shadows: A bet on which team will kill the first Lord of Shadows on the specified map.",
      "Map No. - Total Kills before shield of Tower Disappear: A bet on the total of kills before the tower shield disappears on the specified map. The calculation is based on the in-game timer.",
      "Map No. - Support Role total kills: A bet on the total number of kills that will be attributed to heroes playing the support role on the specified map.",
      "Map No. - Which Role to Draw First Blood: A bet on which role will make the first kill on the specified map.",
      "Map No. - First/Second Mid River Spirit Spawn location: A bet on which part of the river the River Spirit will first appear on the specified map: Lower or Upper.",
      "Map No. - Which role will be killed first: A bet on which role will die first during the first blood on the specified map.",
      "Map No. -Total Tyrant and Shadow Tyrant slayed: A bet on the total number of Tyrant and Shadow Tyrant kills by both teams during the match on the specified map.",
      "Map No. - First Tempest Dragon Spawn location: A bet on the spawn location of the first Tempest Dragon on the specified map: in the Lord of Shadows or Tyrant's lair.",
      "Map No. -Tempest Dragon slayed: A bet on which team will kill the Tempest Dragon on the specified map.",
      "Map No. - First Tower Destroyed within 5 minutes 30 seconds: A bet on whether the first tower will be destroyed on the specified map before the specified time according to the in-game timer.",
      "Map No. - First Tower Destroy location: A bet on which part of the map the first tower will be destroyed on the specified map: Bottom, Middle, or Top lane.",
      "Map No. - Total High Ground Towers destroyed: A bet on the total number of destroyed towers near the Crystal (Nexus) on both sides."
    ]
  },
  {
    "title": "Rainbow Six",
    "paragraphs": [
      "Bets on all outcomes are accepted including overtime or regular time depending on the name of the market."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - First half - 1x2: A bet on a team to win the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 4 rounds.",
      "Map No. - Second half - 1x2: A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Will there be overtime: A bet on whether there will be overtime on the specified map.",
      "Total rounds: A bet on the total number of rounds played by both teams in the match",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team in the match",
      "Map No. - Team X total rounds: A bet on the specified team winning the specified number of rounds on the specified map.",
      "Rounds handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total number of winning or losing rounds in the match.",
      "Map No. - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map, excluding overtime.",
      "Map No. - Race to rounds: A bet on which team will win the selected number of rounds on the specified map first.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 6:6, all outcomes are settled as losses.",
      "Map No. - First half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - First half round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map.",
      "Map No. - Second half round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the second half on the specified map.",
      "Map No. - Defenders total rounds: A bet on the total number of rounds the defending side will take on the specified map.",
      "Map No. - Attackers total rounds: A bet on the total number of rounds the attacking side will take on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: A bet on the number of kills made by both teams on the specified map.",
      "Map No. - Team N Total Kills: A bet on the number of kills made by Team N on the specified map."
    ]
  },
  {
    "title": "Rocket League",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime.",
      "•\tOvertime is a phase in Rocket League that triggers if the game is tied by the end of the match timer. The phase is a Sudden Death mode, where the timer runs infinitely, and the match doesn’t end until either team scores a goal, similar to the Golden Goal rule in soccer."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Odd/Even goals: A bet on the odd or even number of goals scored on the specified map. Total goals: A bet on the total number of goals scored by both teams in the match. Team X - Total goals: A bet on the total number of goals scored by the specified team in the match Map No. - Team X total goals: A bet on the specified team scored the specified number of goals on the specified map.",
      "Goal handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total goals scored or missed in the match.",
      "Draw no bet: A bet on the winner of a map or match without a draw. If the map or match ends in a draw, bets on the market will be returned.",
      "Map No. - Goal handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of scored or missed goals on the specified map.",
      "Map No. - Total Goals: A bet on how many goals both teams will score on the specified map",
      "Map No. - Next goal: A bet on which team will score a selected goal on the specified map first.",
      "Map No. - Correct score: A bet on the exact score of goals on the specified map."
    ]
  },
  {
    "title": "Deadlock",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics. To win, the team must destroy enemies' defensive buildings, push into their base, and kill the Patron."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: A bet on the winner of the match.",
      "1x2: A bet on the winner of the match considering a draw. Offered in matches where a draw is possible (e.g., in a bo2 series).",
      "Map No. -  Winner: A bet on the winner of the selected map.",
      "Total Maps: A bet on the total number of played maps in the match.",
      "Map Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing maps."
    ]
  },
  {
    "title": "Mortal Kombat",
    "paragraphs": [
      "•\tBets are accepted on various versions of the game (information about this is available during the broadcast), but only in 1vs1 format.",
      "•\tAll bets are settled after the completion of the event.",
      "•\tBets on fighters are accepted only during live betting. The game is broadcasted online on a publicly available source.",
      "•\tGame format: Best of 3 to 9 rounds; Winner is the player who achieves an unassailable number of wins (information about the number of the rounds is in the tournament name).",
      "•\tRound duration is the number of seconds elapsed from the start of the round, obtained by subtracting the final smallest number of the timer from 90 seconds (the standard round start timer). E.g., if the round timer countdown stopped at 40, the round duration is 90 - 40 = 50 seconds.",
      "•\tThe number of each individual game changes before the start of the next game on the broadcast",
      "•\tClips of a game's end can be obtained upon request on the relevant streaming resource (Twitch, Kick, YouTube, Trovo, etc.).",
      "•\tIn cases where the streamer exits the game through the game menu before the fight begins, bets remain valid for the next game.",
      "•\tDuring a fight, If one of the players exits the match the round and accordingly the game are considered won by the player who remained in the fight (even if they were in a losing position at the time one fighter exited the fight).",
      "•\tIf circumstances arise making the match result unknown, all bets on markets where results were determined will be settled according to the results available at the time the player exited; all other bets will be made void.",
      "•\tIf the streamer changes the game mode, all bets made before the fight begins will made void.",
      "•\tWe bear no responsibility for any actions of the streamer, bugs, or software errors in the game that affect the result.",
      "•\tWhere there is evidence of integrity issues including stream sniping or stream loose change (a situation where a player joins the stream and loses intentionally), we reserve the right to void all bets at our discretion."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Fight/Round): - Settled on the fighter declared the winner by knocking out the opponent (signified by the loss of all the opponent’s energy).",
      "Total rounds: - Settled on the total number of rounds fought being under or over the given line.",
      "Handicap: - Determined by which player will win the match once the specified handicap line is applied to the final round score.",
      "Round duration: - Settled on the total seconds elapsed in the round being under or over the given line.",
      "Will there be a Flawless Victory: - Settled as a victory in which the winner did not take damage from the opponent and did not harm themselves (sometimes a fighter may injure themselves while performing particularly dangerous attacks). A sign that a Flawless Victory is counted is the phrase Flawless Victory at the end of the broadcast;",
      "Will the player perform a Fatal Blow or Crushing Blow: - A Fatal Blow is a special move that deals significant damage to the opponent but becomes available only when the player's health is at 30% or below. Type of finishing moves: brutality, fatality, or none (Faction Kill counts as a fatality).   Round winner: - Winner of that specified round.  Finish Type: - Brutality, fatality, will or will not happen (Faction Kill is considered to be fatality)."
    ]
  },
  {
    "title": "E-Football",
    "paragraphs": [
      "E-Football tournaments are held on game platforms based on electronic football simulators. The rules and format of the tournaments are determined by the leagues that hold the tournaments (eRivals League, Cyber Live Arena, Esports Pro Club and others).",
      "•\tSettlement rules unless expressed below remain the same as our football rules.",
      "•\tBets on e-football matches are accepted based on the regular game time and added injury time added by the virtual referee unless specified.",
      "•\tFor competitions where extra time and/or penalty shootouts occur, these markets are priced and resulted separately to the regular time markets",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf the event is interrupted, bets are voided, with the exception of bets whose results are clearly determined before the event is stopped and have already been calculated",
      "•\tAll bets are settled after the actual conclusion of the event.",
      "•\tThe number of substitutions is not limited, the composition of the players for the teams can be any amount.",
      "•\tE-Football Rules apply to the following tournaments: EAFC 24. 2x4 min., Volta Rush. EAFC 24, Volta Football League. EAFC 24.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "EAFC 24",
    "paragraphs": [
      "•\tThis is a game mode in the FIFA football simulator in which players, whose teams consist of 11 players from each side, play against each other on a virtual football field.",
      "•\tDuration of regular time: 8 minutes (2 halves of 4 minutes each).",
      "•\tGame format: 11x11 players.",
      "•\tFor certain tournament formats in the event of a draw at the end of regular time, additional periods (Extra Time) and a series of post-match penalties are provided."
    ]
  },
  {
    "title": "Volta Rush & Volta Football League. EAFC 24",
    "paragraphs": [
      "•\tA game mode in EAFC 24 Football Simulator where players play against each other on a small virtual football pitch, a street-style pitch.",
      "•\tMatch duration: 6 minutes (2 halves of 3 minutes each).",
      "•\tGame format: determined by the leagues organizing the tournaments, can be 3x3 or 4x4 (information about the game format is indicated in the tournament's name).",
      "•\tLevel of difficulty: determined by the leagues holding the tournaments",
      "•\tStadium for the game: determined by the leagues organizing the tournaments."
    ]
  },
  {
    "title": "E-Basketball",
    "paragraphs": [
      "•\tE-Basketball is a virtual computer simulation of a live match, or with the participation of professional E-Basketball players.",
      "•\tMatches are played with 4 quarters of 4, 5, 6, 10, or 12 minutes (duration of the quarter specified in the tournament name), overtime of 3 minutes\".",
      "•\tDifficulty level: \"Hall of Fame\".",
      "Available main market types include:",
      "•\tWin including overtime",
      "•\tHandicap including overtime",
      "•\tTotal including overtime (over/under)",
      "•\tIndividual player totals including overtime (over/under)",
      "•\tQuarter winner",
      "•\tQuarter handicap",
      "•\tQuarter total (over/under)",
      "•\tIndividual player quarter totals (over/under)",
      "•\tStatistical Markets (2 or 3 point shots made)  - 1x2 (Match/Quarter) Which Team will have the most 2/3 point shots made, includes Overtime period. - Total Over/Under (Match/Quarter) 2/3 point shots made. - Handicap (Match/Quarter): Bet on the team to win the match by the number of 2 or 3 point shots, if the specified handicap is applied to the total number of shots made. - Total Away / Home (Match/Quarter): The total number of 2-point or 3-point shots scored in a match or in a certain quarter by a certain team. It is necessary to predict whether the result will be greater or less than a certain total for that team.         - Odd/Even (Match/Quarter): Bet on whether the total number of 2-point or 3-point shots scored in a match or in a given quarter will be even or odd.",
      "•\tIf an event is recreated with new data, times or teams, previous bets will be void.",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "Streetball",
    "paragraphs": [
      "•\tStreetball esports is one of the game variants of NBA2K basketball simulator.",
      "•\tGame can be played in various formats: 1x1, 2x2, 3x3, 4x4, and 5x5 (information about the game format is indicated in the tournament's name).",
      "•\tDifficulty level: \"Hall of Fame\"",
      "•\tRoster (parameters and strength of participants): \"Official\" at the start of the event (if the game is played in formats 2x2, 3x3, 4x4, and 5x5, the match involves the strongest players from participating teams).",
      "•\tThe game is played on one hoop up to 11 points.",
      "•\tEach successful shot inside the six-meter line (6.2 meters) or from the penalty line earns the team/player 1 point.",
      "•\tA shot beyond the six-meter line earns 2 points.",
      "•\tIf one participant/team reaches 10 points and the score difference is less than 2 points, the game continues until the score difference becomes more than 1 point.",
      "•\tAvailable bet types include:",
      "•\tWin",
      "•\tHandicap",
      "•\tTotal (over/under)",
      "•\tEven/Odd total",
      "•\tIndividual player/team totals (over/under)",
      "•\tRace to points",
      "•\tVictory in the draw (which player/team will score point #1, #2, #3, etc.).",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "E-Tennis",
    "paragraphs": [
      "•\tE-Tennis is a virtual tennis competition simulated by a computer program (imitation of a real match using the game \"AO Tennis\" or \"Tennis World Tour 2\"; information about the game is in the name of the tournament). The game model is formed by artificial intelligence, which is responsible for the results of the matches.",
      "•\tMarket rules are the same as Tennis rules for market settlement.",
      "•\tMatches may consist of 1, 3, or 5 sets depending on the match or tournament format (information is in the tournament name).",
      "•\tIf a court change occurs including a surface change, bets will remain valid.",
      "•\tAvailable market types:",
      "•\tHandicap",
      "•\tTotal (over/under)",
      "•\tIndividual totals (over/under)",
      "•\tExact score",
      "•\tEven/odd total",
      "•\tGame winner",
      "•\tPlayer win + total games",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "E-Ice Hockey",
    "paragraphs": [
      "•\tE Ice Hockey is a virtual hockey competition with the participation of professional players.",
      "•\tThe rules are the same as those in real hockey games. The length of the period is indicated in the name of the tournament.",
      "•\tAll match markets are settled in regular time (competition specific) unless otherwise stated.",
      "•\tIn the event of a scheduled event being postponed or abandoned, all bets will be void unless the match resumes within 48 hours of the event time, unless an official winner is announced by the governing competition body.",
      "•\tGoals scored in overtime are not counted for markets related to the 3rd period or regular time.",
      "•\tAvailable Markets:",
      "- Winner/moneyline (Match/Period): The team which officially wins the match or specified period. Bets on the match moneyline are settled on the winner of the game, including overtime and shootout. - 1x2 (Match/Period): The team that will be the official winner in the match or in a certain period. It is calculated based on the result of regular time only, excluding overtime. - Total (Match/Period): Total number of goals scored in a match or period. The calculation of the bet is determined by whether the result will be more or less than the offered amount. - Handicap (Match/Period): Bet on the team to win the match if the specified handicap is applied to the total score of the match or a certain period. - Total Away / Home (Match/Period): Total number of goals scored in a match or in a certain period by a certain team. It is necessary to predict whether the result will be greater or less than a certain limit. - Double Chance (Match/Period): You need to predict the official result of a match or a certain period included in the prediction, where two out of three possible options will be winning and one will be losing. - Bet to win without a draw (Match/Period): Bet on the winner of the game in regular time or in a certain period. If the game ends in a draw, bets are void. - Exact Score (Match/Period): Bet on the exact prediction of the final score in a match or specified period. - Xth Goal (Match/Period): You need to predict which team will score a goal with the specified number in the specified period. - Both Teams to Score (Match/Period): Bet on whether both teams will score at least one goal in regular time of the match or in the specified period. - Odd/Even (Match/Period): Bet on whether the total number of goals scored in a match or period will be odd or even."
    ]
  },
  {
    "title": "Rule 4 calculation",
    "paragraphs": [
      "When placing a bet on an outright market, there is a possibility for a selection within the outright market to be withdrawn before there is an opportunity for the event to take place. This is very common within Horse Racing and Greyhounds but can also apply to other sports. This is applied as a general rule industry wide to compensate for the variation in prices when a selection falls within a certain price range due to how the market was calculated with the withdrawn selection at the time the book was made.  Rule 4 deductions are applied after final declarations for a race are made. This happens at different times depending on the sport and event.  A Rule 4 deduction follows the below guidelines and is simple to calculate. Depending on the price of the selection that was withdrawn, a reduction of winnings is quoted for every $1/£1/€1 of your winnings. These are as follows:"
    ]
  },
  {
    "title": "Deduction (Pence/Cent)",
    "paragraphs": [
      "1.11 or shorter",
      "90 p/c",
      "1.18 to 1.12",
      "85 p/c",
      "1.25 to 1.20",
      "80 p/c",
      "1.30 to 1.29",
      "75 p/c",
      "1.40 to 1.33",
      "70 p/c",
      "1.53 to 1.45",
      "65 p/c",
      "1.62 to 1.57",
      "60 p/c",
      "1.80 to 1.66",
      "55 p/c",
      "1.95 to 1.83",
      "50 p/c",
      "2.00 to 2.20",
      "45 p/c",
      "2.25 to 2.50",
      "40 p/c",
      "2.60 to 2.75",
      "35 p/c",
      "2.80 to 3.25",
      "30 p/c",
      "3.40 to 4.00",
      "25 p/c",
      "4.20 to 5.00",
      "20 p/c",
      "5.50 to 6.50",
      "15 p/c",
      "7.00 to 10.00",
      "10 p/c",
      "11.00 to 15.00",
      "5 p/c"
    ]
  },
  {
    "title": "No deduction",
    "paragraphs": [
      "If more than one selection is withdrawn, the maximum rule 4 deduction that can be applied is 90p/c (Pence/Cent) in every $/£/€1 won."
    ]
  },
  {
    "title": "Cash Out Rules",
    "paragraphs": [
      "•\tCash-out is the feature through which the user can request an early settlement of their bet (before the completion of the sporting event) for a stated return.",
      "•\tCash-out is offered only for the bet type - Single. For various markets, matches or competitions; the option may not be offered or temporarily suspended by the company.",
      "•\tCash-out can be used at any time after placing the bet whilst the sale option is available for this bet. In some cases, the sale option for the bet may be unavailable for various technical reasons (lack of match broadcasting capability, technical errors in score display, etc.), but its operation may be restored later.",
      "•\tTo sell a bet, you must be a registered user and logged in to your account. The option is available in the sections of the website \"Coupon - My Bets\" and \"Profile - Bet History.\" When opening the details of the bet, you need to press the \"Cash-out\" button at the bottom of your bet.",
      "•\tThe amount to be returned is displayed in the bet coupon in the \"Cash-out\" line. The amount may vary continually and is calculated separately for each specific bet.",
      "•\tDelays may occur when processing a cash-out request. The cash-out request may be unsuccessful if the selection was not available to bet on (suspended or closed) or if the amount to be returned has been recalculated during the request process.",
      "•\tThe proposed cash-out amount at any given time is the amount that will be returned to your account if the request is successful.",
      "•\tThe Organizer reserves the right to cancel the cash-out option in the following cases:",
      "•\tThe cash-out amount was displayed incorrectly.",
      "•\tThe request was made after the result of the event on which the bet was placed became known.",
      "•\tIf the bet or result was settled erroneously.",
      "•\tIf cash-out participated in bonuses or promotions.",
      "•\tIn case of cancellation of the bet sale option, settlement will be made according to the result of the sporting event on which the bet was placed.",
      "•\tThe Organizer reserves the right to change the conditions or not offer the cash-out option without explaining the reasons and without giving prior notice."
    ]
  },
  {
    "title": "Single Bet",
    "paragraphs": [
      "A single bet or straight bet is a bet on a single selection within a single event. It is the simplest type of bet, where your selection must win to receive a return."
    ]
  },
  {
    "title": "Accumulator / Combo Bet",
    "paragraphs": [
      "A bet with selections made on two or more different events combined into a single staked bet. The odds are calculated by multiplying the odds of all the selections together. All selections must win for you to receive a return."
    ]
  },
  {
    "title": "System Bets / Permutations",
    "paragraphs": [
      "A bet with selections from three or more different events. You have the option to them combine these selections into a multiple of smaller bets with all possible combinations of accumulator bets possible.",
      "This is calculated depending on the number of selections you add to the betslip, for example if you add 3 selections, then there are 3 combinations of doubles available (A+B, A+C, B+C). The stake is then selected and spread evenly between the number of possible combinations within the bet. To receive a partial pay out, in this example 2 selections must win to receive a return. The maximum return will be paid if all three selections win.   Please be aware that it is possible for your return to be less than your initial stake depending on pricing and number of selections added into the system bet."
    ]
  },
  {
    "title": "Placing bets from the bonus balance",
    "paragraphs": [
      "•\tWhen placing bets from the bonus balance, the terms and conditions for wagering the active bonus apply.",
      "•\tStakes made with bonus balance will not be calculated in the overall return.",
      "•\tIf a bet was placed from an bonus balance which expired before the bet settlement, then this bet will be considered void, and further settlements will not be made.",
      "•\tEach player has two balances - real and bonus. Initially, bets are placed using their real balance. Only when the sum in the player's real account equals zero does the player start playing with bonus money. All winnings obtained while playing with bonus money are credited to the player's bonus balance.",
      "•\tIf a bet is made from a bonus balance that has been subsequently played through (converted into real funds), no further settlements will be made for such a bet.",
      "•\tIf a player, for any reason, does not wish to use bonus funds, they may place bets exclusively with real funds without involving bonuses. The current amount of available real funds is always accessible to the player after clicking on the balance at the top of the screen."
    ]
  },
  {
    "title": "E Sports Betting Rules",
    "paragraphs": [
      "•\tThe general terms and conditions, along with the betting rules are accepted upon account registration. General betting rules are superseded by specific sporting rules where they are specifically stated within these terms.",
      "•\tThe minimum stake for any customer is {X} (Please ensure this is eligible to add under the license or jurisdiction of the operator)",
      "•\tIn instances where we see collusion between players and statistically unusual betting patterns, or in instances that involves professional players. We reserve the right to limit payout to the entire group as per the single player maximum win.",
      "•\tThe minimum and maximum bet stake for any selection, market or event may change at any given time and without prior notice."
    ]
  },
  {
    "title": "Bet Builder Settlement Rules",
    "paragraphs": [
      "1. Single BetBuilder",
      "Definition:",
      "A BetBuilder is a single bet that combines multiple selections (legs) from the same event (e.g., \"Player A to score + over 2.5 goals in the match\").",
      "Settlement Logic:"
    ]
  },
  {
    "title": "All legs win",
    "paragraphs": [
      "✅ BetBuilder wins – full payout."
    ]
  },
  {
    "title": "Any leg loses",
    "paragraphs": [
      "❌ BetBuilder loses – entire bet is settled as lost."
    ]
  },
  {
    "title": "Any leg is void (e.g., player doesn’t play)",
    "paragraphs": [
      "⚠️ Whole BetBuilder is void – stake is refunded.",
      "Key Rule:",
      "•\tIf one leg is void, even if others win, the entire BetBuilder is void.",
      "2. BetBuilder Combined with Other Selections (i.e., part of a multiple)",
      "Definition:",
      "A BetBuilder is one leg in a multiple (accumulator) that includes other unrelated selections from different matches or markets.",
      "Settlement Logic:"
    ]
  },
  {
    "title": "BetBuilder wins + other legs win",
    "paragraphs": [
      "✅ Full multiple wins – full payout."
    ]
  },
  {
    "title": "BetBuilder wins + any other leg loses",
    "paragraphs": [
      "❌ Multiple loses."
    ]
  },
  {
    "title": "BetBuilder is voided (due to a void leg) + other legs win",
    "paragraphs": [
      "⚠️ BetBuilder leg is voided → multiple is settled based on remaining selections."
    ]
  },
  {
    "title": "BetBuilder is voided + any other leg loses",
    "paragraphs": [
      "❌ Bet loses (loss from remaining leg).",
      "Key Rule:",
      "•\tIf a leg within the BetBuilder is void, the entire BetBuilder is void, and the multiple continues with reduced odds (or becomes a single if only one leg remains).",
      "3. Multiple BetBuilders (i.e., multiple BetBuilders in a single accumulator)",
      "Definition:",
      "An accumulator consisting of multiple separate BetBuilders from different matches.",
      "Settlement Logic:"
    ]
  },
  {
    "title": "All BetBuilders win",
    "paragraphs": [
      "✅ Full multiple wins."
    ]
  },
  {
    "title": "Any BetBuilder loses",
    "paragraphs": [
      "❌ Entire multiple loses."
    ]
  },
  {
    "title": "One or more BetBuilders are voided (due to voided leg inside)",
    "paragraphs": [
      "⚠️ Those BetBuilders are void → accumulator recalculated based on remaining valid BetBuilders.",
      "Key Rule:",
      "•\tEach BetBuilder is treated as a leg.",
      "•\tIf a leg within a BetBuilder is voided → that BetBuilder is void, but the rest of the multiple still stands."
    ]
  },
  {
    "title": "Esports",
    "paragraphs": [
      "Rules for esports disciplines are an addition to the general betting rules. In case of discrepancies or conflicts, specific points of the esports rules take precedence over general sports rules.",
      "The format of an esports match is determined by the regulations of the tournament organizer. A match can have a format consisting of one or several maps/games:",
      "•\tBest of 1 (Bo1) - A series of games up to 1 win.",
      "•\tBest of 2 (Bo2) - A series of 2 games (a draw is possible).",
      "•\tBest of 3 (Bo3) - A series of games up to 2 wins.",
      "•\tBest of 5 (Bo5) - A series of games up to 3 wins.",
      "•\tBest of 7 (Bo7) - A series of games up to 4 wins.",
      "•\tBest of 9 (Bo9) - A series of games up to 5 wins.",
      "According to tournament rules or the organizer's decision, a team may be given a map advantage before the game starts. Match in money line include a note regarding the format's specifics, and the default map is considered as if it were actually played.",
      "For all markets where overtime is considered in the settlement, the market name contains incl. overtime. All other markets will be settled on the result of regular time only.",
      "The final result for sports such as Dota 2, League of Legends, Wild Rift, King of Glory, etc., is based on the data recorded immediately after the destruction of the main building (Throne/Fortress/Nexus) of one of the opponents. Similarly, the calculation is made if one of the teams surrenders Throne/Fortress/Nexus is not destroyed directly by the opponent in this case). Victory is awarded to the surrendering team's opponent."
    ]
  },
  {
    "title": "Refund of bets",
    "paragraphs": [
      "Unsettled bets are refunded if the match is postponed for more than 48 hours from the scheduled start time. If the match is delayed by more than 48 hours after the start, bets on outcomes that have already occurred (e.g., round winner or first kill) remain valid and settled.",
      "If the match is delayed for 48 hours or less after the start, the following rules apply:",
      "•\tResumption from the current score or specific moment/time on the map. All bets remain valid and will be settled based on the final result of the match.",
      "•\tReplay (restart). All bets for which the outcome was determined at the time of interruption remain valid. All unsettled bets will be refunded. Replayed maps or matches will be considered as a new match.",
      "In case of a change in the planned number of maps, bets on the match winner, total maps, correct map score, map handicap, and total maps odd/even will be refunded. Bets on map markets will be settled according to the final score of the specified map.",
      "If one of the teams (players) does not continue the match or match period, bets are calculated as follows:",
      "•\tBets on map winner (if started but not completed) and match winner will be settled according to the official result;",
      "•\tBets on markets and outcomes where the result has been determined will be settled according to that result (including handicap on maps, correct map score, total and even/odd number of maps)."
    ]
  },
  {
    "title": "Example 1",
    "paragraphs": [
      "A bet on total maps over 2.5 in a bo3 match will be settled if the withdrawal occurred with a score of 1:1 on maps and refunded if the score was 1:0, 0:1 or 0:0;"
    ]
  },
  {
    "title": "Example 2",
    "paragraphs": [
      "A bet on a Map handicap -1.5/+1.5 will be settled if any team loses or wins the required number of maps for the market to be considered settled (example, 1:0 on maps in a bo3 match will mean a loss for a Map handicap -1.5 for Team2). If a withdrawal occurred with a map score that does not allow the outcome to be determined, bets will be refunded (example, 1:0 on maps in a bo3 match for a bet on the Map handicap -1.5 for Team1;",
      "•\tFor all cases, bets on markets whose outcome has not been determined will be refunded. If the map has not started, then all results of this map (including map winner) will be refunded.",
      "The rules apply if the reason for technical defeat/withdrawal/forfeit is not the disqualification of the team, when the settlement of bets is made on the basis of a separate section of the rules.",
      "If a disqualification is awarded by the organizer after the completion of a map/game due to the team/player gaining an advantage through:",
      "•\tUse of forbidden tools (aimbots, snap tap, cheats);",
      "•\tExploiting game bugs;",
      "•\tCheating, match-fixing;",
      "•\tOther actions that undermine the fairness of the game.",
      "all bets, or bets on map markets, will be refunded depending on the type of punishment imposed on the team.",
      "Bets are not refunded due to technical defeat after the end of the match in the following cases:",
      "•\tViolation of the tournament rules, principles of fair play, sports ethics;",
      "•\tDisqualification of a team or player due to an unsportsmanlike element;",
      "•\tParticipation of an ineligible player (age restrictions, citizenship, etc.), but excluding use by the team a ringer/faker - different player on the account);.",
      "•\tReplay of the tournament bracket due to disqualification of any team.",
      "Bets are also not refunded in the following cases:",
      "•\tGrammatical errors in team or tournament names;",
      "•\tSubstitutions in team lineups before and during the match (excluding changing its lineup by more than 50%);",
      "•\tChanging the team name without changing its lineup by more than 50%;",
      "•\tReplaying a round;",
      "•\tPlaying with unequal lineups."
    ]
  },
  {
    "title": "Fixed Matches, Unsportsmanlike Conduct",
    "paragraphs": [
      "If there are signs of unsportsmanlike conduct or a fixed match, the Company, at its discretion and without the match organizer's acknowledgment of a breach of sporting principles, reserves the right to:",
      "•\tSuspend the settlement of bets for up to 72 hours;",
      "•\tDecide to refund bets if there are signs of unsportsmanlike conduct.",
      "The Company will base its decision on evidence of unsportsmanlike conduct or a fixed match from its own sources. The Company does not provide gamblers with evidence of a breach of sporting principles in a suspicious match."
    ]
  },
  {
    "title": "Main Markets",
    "paragraphs": [
      "Winner: A bet on the winner of the match.",
      "1x2: A bet on the winner of the match considering a draw. Offered in matches where a draw is possible (e.g., in a bo2 series).",
      "Double Chance: A bet on two out of three possible outcomes in matches in best of 2 format (1X, X2, 12).",
      "Map No. - Winner: A bet on the winner of the specified map in the match.",
      "Total Maps: A bet on the total number of maps played within the match.",
      "Map Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing maps.",
      "Correct map score: A bet on the exact final score in the match by maps.",
      "Odd/Even Total Maps: A bet on the even or odd number of maps in the match."
    ]
  },
  {
    "title": "Player Markets",
    "paragraphs": [
      "Player markets are calculated in accordance with internal data and, if necessary, are confirmed on the specified sites or video broadcasts:",
      "•\tCounter-Strike - hltv.org",
      "•\tDOTA2 - dotabuff.com",
      "•\tValorant - vlr.gg",
      "•\tLeague of Legends - gol.gg",
      "If a player is replaced before and after the start of the match, bets on all unsettled outcomes with his participation will be refunded."
    ]
  },
  {
    "title": "Counter-Strike",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime or regular time depending on the name of the market;",
      "•\tOvertime. Victory on the map is achieved by winning at least 13 rounds. In a tie situation on the map (when the score is 12:12 by rounds, tournaments usually provide for 6 additional rounds, the so-called \"overtime\"). Victory in overtime is awarded to the team that first wins 4 out of 6 additional rounds. If overtime ends in a draw (both teams have won 3 rounds each), another overtime (6 additional rounds) is scheduled."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Total Rounds: A bet on the total number of rounds played by both teams within the match.",
      "Round Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the match.",
      "Match - Team X total rounds - A bet on whether Team N wins more or fewer than the specified number of rounds on the specified match.",
      "Map No. - First Half - 1x2: A bet on a team to win the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 7 rounds. For matches in the MR15 format, a market First Half - Winner is offered without taking into account a draw.",
      "Map No. - Second Half - 1x2 : A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The start of the second half is the 13th round (or 16th for the MR15 format). The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First Half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - Second Half correct score: A bet on the exact score by rounds on the second half on the specified map. Map No. - First half  - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map. Map No. - Second half  - Round handicap: A bet on the Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First half  - Team X Total rounds: A bet on the total number of rounds won by the specified team on the first half on the specified map.",
      "Map No. - Second half - Team X Total rounds: A bet on the total number of rounds won by the specified team in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Second half - Total rounds: A bet on the total number of rounds played in the second half on the specified map .The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Odd/Even number of rounds: A bet on the odd or even number of rounds played on the specified map.",
      "Map No. -  Will there be overtime?: A bet on whether there will be overtime on the specified map.",
      "Map No. - Will there be a Team kill?: A bet on whether there will be a Team Kill from the selected team on the specified map. Team Kill refers to a player \"killing\" their teammate.",
      "Map No. - Will there be a knife kill?: A bet on whether there will be a kill by knife from the selected team on the specified map.",
      "Map No. - Will ACE be in round No.?: A bet that a player will make 5 kills (kill the entire opposing team) in the selected pistol round on the specified map.",
      "Map No. - Will there be a Zeus X27 kill?: A bet on whether there will be a kill by Zeus X27 on the specified map.",
      "Map No. - Pistol round No. winner: A bet on which team will win the selected pistol round on the specified map.",
      "Map No. - Both pistol rounds winner: A bet on which team will win both pistol rounds on the specified map.",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team within the match.",
      "Example: a player bets on more than 21.5 for Team #2, and in a bo3 match, the mentioned team loses with scores of 13-11; 13-10. The total number of rounds won by Team #2 = 21 (11+10) - the bet loses because the number of rounds won is less than the total value. Conversely, if the bet was placed on less than 21.5 with a total of 21 rounds won in the match, it wins.",
      "Team X - Total pistol round wins: A bet on whether the specified team wins the chosen number of pistol rounds in the match.",
      "Map No. - Correct pistol rounds score: A bet on the exact score by pistol rounds (1st and 13th) on the specified map..",
      "Map No. - Total rounds: A bet on the total number of rounds within the map. For example, if a player bets on over 22.5 and there are a total of 20 rounds played on the map, the bet loses because the total number of rounds played is less than the total value. If the bet was placed on under 22.5 with 22 rounds played, it will be settled as a win.",
      "Map No. - Total rounds (3 way): A bet on the total number of rounds played in the map, with three possible outcomes: under a specified number of rounds, over a specified number of rounds, or exactly a specified number of rounds.",
      "Map No. - Team X - total rounds: A bet on the number of rounds won by the team on the specified map (over or under).",
      "Map No. - Team X - total rounds as Terrorists/Counter-Terrorists: A bet on the number of rounds won by the team on the specified map (over or under) while playing on the specified side: Terrorists or CT (Counter-Terrorists).",
      "Map No. - Total bomb explosion: A bet on the total number of rounds within the specified map that ended with a bomb explosion.",
      "Map No. - Total kills in pistol rounds: A bet on the total number of kills from both teams in the selected pistol round on the specified map.",
      "Map No. - Round Handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map.",
      "Map No. - Round handicap (3 way): A bet on which team will win a specific round with a handicap, offering three possible outcomes: Team 1 wins with the handicap, Team 2 wins with the handicap, or a tie considering the handicap.",
      "Map No. - Asian total rounds: Asian total rounds involve betting on the total number of rounds played in a match using fractional values such as 20.25, 20.75, etc. These bets are divided into two parts, allowing for partial returns or partial losses. Examples:",
      "•If a bet on over 20.25 total rounds and 21 rounds and more are played, both halves of bet win. If 20 rounds are played, half of bet (on 20) is refunded, and the other half (on 20.5) loses;",
      "•If a bet on over 20.75 total rounds and 21 rounds are played, half of bet (on 20.5) wins, and the other half (on 21) is refunded. If 22 rounds and more are played, both halves of bet win.",
      "Map No. – Asian round handicap: is a type of bet used to balance the odds between two teams or players by adding or subtracting a certain number of rounds from their final score. When using quarter handicaps (e.g., -0.25 or +0.75), the bet is split into two parts: one with the nearest whole number, the other with the nearest half number, reducing the risk of a full loss.",
      "Map No. - Round No. Winner: A bet on a team to win a selected round on a specified map.",
      "Map No. - Race to rounds: A bet on which of the teams will first win the selected number of rounds on the specified map.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 12:12 (15:15 for MR15), all outcomes are settled as losses.",
      "Map No. - Round X - Method of victory: A bet on the method of victory of any of the teams in the selected round on the specified map. Victory in the round is achieved by one of the possible methods: opponent eliminated, bomb explosion/defusal, or expiration of round time without the bomb being planted.",
      "Map No. - 1x2 of Nth overtime: A bet on the winner of the selected overtime of the specified map, a draw is considered as an option.",
      "Map No. - Overtime No. - Round handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified оvertime.",
      "Map No. - Overtime No. - Correct Score: A bet on the exact score by rounds in the specified overtime on the specified map",
      "Map No. - Overtime No. - Odd/Even number of rounds: A bet on the odd or even number of rounds in the specified overtime on the specified map.",
      "Map No. - Overtime No. - Total rounds: A bet on the total number of rounds played in specified overtime on the specified map.",
      "Map No. - Overtime No. - First half - Winner: A bet on the team that will win two rounds first in specified overtime on the specified map.",
      "Map No. - Total Under + Win: A bet on which team will win the map and the total number of rounds played will be less than a certain total value.",
      "Map No. - Total over + Win: A bet on which team will win the map and the total number of rounds played will be greater than a certain total value.",
      "Map No. - Winning margin: A bet on the team's victory within a certain range of rounds. Team victory on the specified map with a margin of rounds within the selected range after the map ends. Example: Team A wins 13-7. The winning margin for this result is 5-7 rounds.",
      "Map No. - Will there be a Molotov (Incendiary Grenade) kill: A bet on whether there will be a kill by Incendiary Grenade by any of the teams on the specified map. If someone will kill his enemy by Grenade but not by fire this outcome will be settled as “yes”. Map No. – Will there be HE Grenade kill: A bet on whether there will be a kill by HE Grenade from any of the teams on the specified map. If someone will kill his enemy by Grenade but not by fire this outcome will be settled as “yes”.",
      "Map No. - Player X - Total Kills: A bet on the total number of kills by Player N on the specified map. Map No. - Player X - Total Deaths: A bet on the total number of deaths by Player N on the specified map (incl. death as a result of team kill, suicide and bomb explosion).",
      "Map No. - Round X - Total Kills: A bet on the total number of kills by both teams in round. Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies) in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map. Map No. - First kill in round: A bet on the team that will make the first kill (entry frag) in the specified round.",
      "Map No. - Team X total kills in the round: A bet on the total number of enemy kills from team N in the selected round on the specified map.",
      "Map No. - Duel of players - Winner by kills: A bet on comparing players by the number of kills made on the specified map. In the event of an equal number of kills, bets on the market will be refunded.",
      "Map No. - Duel of players - 1X2 by kills provides for a bet on comparing taking into account a draw.",
      "Map No. - Duel of players - Handicap by kills: A bet on the outcome of a duel between two players with a handicap applied based on the number of kills.",
      "Map No. - Win First Half + Win Map: A bet on a team to win the first half and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win Map: A bet on a team to win the first pistol round and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win First Half: A bet on a team to win the first pistol round and the first half of the specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Odd/Even number of kills: A bet on the total even or odd number of kills on the specified map.",
      "Map No. - Total kills: A bet on the total number of kills on the specified map.",
      "Map No. - Total deaths: A bet on the total number of deaths on the specified map (incl. death as a result of team kill, suicide and bomb explosion).",
      "Map No. - Round No. - Total Kills by Player X: A bet on the total number of enemy kills from player N in the selected round on the specified map.",
      "Map No. - Round No. - Will the Player X die: A bet on the player's N death in the selected round on the specified map.",
      "Map No. - Round No. - Player X make a kill: A bet on the one and more kills by Player N in the selected round on the specified map.",
      "Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies) in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map.",
      "Map No. - Round N - Will Ace be in the round?: A bet on whether any player kills the whole enemy team in the specified round of the map.",
      "Map No. - Total headshots: A bet on the total number of headshots (kills in head) on the specified map."
    ]
  },
  {
    "title": "Dota 2",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: Bet on the number of kills made by both teams on the specified map. The final value of the team's kill counter (count near the timer) is taken into account, not kills or deaths of heroes in the teams.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - Winner + Total Kills / Map No. - Winner + Duration: A bet on the team's victory on the map considering the total kills and duration.",
      "Map No. - Total Kills Odd/Even: A bet on the even or odd number of kills made by both teams within the specified map, without considering finishing off with neutral creeps, allies, suicides, etc.",
      "Map No. - First Blood: A bet on the first kill on the specified map, without considering finishing off with neutral creeps, allies, suicides, etc.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map. The final value of the team's kill counter (count near the timer) is taken into account, not kills or deaths of heroes in the teams.",
      "Map No. - Race to Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - Kill Maker: A bet on which team will achieve the next kill. The kill count is based on the total number of kills.",
      "Map No. - Kills handicap: A bet on the advantage or disadvantage of one of the teams, expressed in the number of team kills on the specified map. Match - Total Kills: A bet on the number of kills made by two teams during the match. Match - Handicap kills: A bet on the advantage or disadvantage of one of the teams, expressed in the number of kills of each team during the entire match. Match - Team X Total Kills: A bet on the number of kills made by one of the teams during the match. Map No. - Intervals: Total Kills on minute: A bet on the number of kills in a certain range of minutes. Map No. - Will there be a kill at a specific interval of time: A bet on whether there will be a kill within a certain time interval.",
      "Map No. - First Roshan Kill: A bet on the team that will kill Roshan first on the specified map.",
      "Map No. -Total Roshans slain: Bet on the total number of Roshan kills on the specified map (over/under).",
      "Map No. - Both teams kill Roshan: A bet on both teams killing Roshan within the game time on the specified map. Map No. - Winner by Roshan kills: A bet on which of the two teams will kill more Roshans. Map No. - 1x2 by Roshan kills: A bet on which of the two teams will kill more Roshans with a draw.",
      "Map No. - Total Towers destroyed: A bet on the total number of towers destroyed on the specified map",
      "Map No. - Team X Total Towers destroyed: A bet on the number of destroyed towers of one of the teams on the specified map.",
      "Map No. - First Tower destroyed: A bet on which of the teams will destroy the opponent's first tower on the specified map. The loss is credited to the team whose first tower was destroyed earlier than the opponent's, even if the tower is destroyed by their own hand.",
      "Map No. - Towers Handicap: A bet on the advantage or disadvantage of one of the teams, expressed in the number of destroyed towers. Map No. - First Tier 3 Tower Destroy location: A bet on which line the teams will destroy the first tier 3 tower. Map No. - Winner by destroyed towers: A bet on the winner of the map, which team will destroy more towers. Map No. - 1x2 by destroyed towers: A bet on the winner of the map, which team will destroy more towers with a draw.",
      "Map No. - First barrack: A bet on the team that will destroy the barracks first.",
      "Map No. - Both teams will destroy barracks: A bet on both teams destroying all barracks within the in-game timer on the specified map.",
      "Map No. - Total barracks: A bet on the total number of barracks destroyed on the map.",
      "Match - Total barracks: A bet on the total number of barracks destroyed in the match.",
      "Map No. - Ultra Kill: A bet on a series of 4 kills on the specified map. The bet is considered played if an ultra kill is shown/announced in the game. Fixation occurs according to the in-game timer.",
      "Map No. - Rampage: A bet that there will be a series of 5 kills on the specified map. Fixation is based on in-game timer, and is considered played if a Rampage is shown/announced in the game.",
      "Map No. - Godlike: A bet that one of the players will make a series of 9 or more kills of enemy heroes without being killed.",
      "Map No. - Both teams will destroy Barracks: A bet on both teams destroying all barracks within the game time on the specified map.",
      "Map No. - Both teams will kill Roshan: A bet on both teams killing Roshan within the game time on the specified map.",
      "Map No. - Mega Creeps spawned: A bet on one of the teams destroying all enemy barracks in the game, even if mega creeps have not yet appeared.",
      "Map No. - Active Rune will appear at a specific minute on the top or bot side: A bet on whether a rune at a specific minute will appear on the top (upper part of the map) or bot (lower part of the map) side.",
      "Map No. - Kill First Courier: A bet on which of the teams will kill the enemy courier. The bet is considered played after one of the teams kills the enemy courier. If there is no courier kill during the map, the bet will be refunded.",
      "Map No. - Aegis of the Immortal to be snatched: A bet that Aegis of the Immortal will be stolen on the specified map. The condition for winning is if one team kills Roshan, but the Aegis of the Immortal artifact is picked up by a player from the opposite team.",
      "Map No. - Divine Rapier: A bet on one of the players purchasing the Divine Rapier artifact during the map.",
      "Map No. - Kill first tormentor: A bet on which team will kill Tormentor first on the specified map.",
      "Map No. - One of the teams will lead in gold until a specific minute: A bet on which of the teams will lead in gold up to a certain time. The time is counted according to the in-game timer. For example, Team #1 leads in gold at the 10th minute of the map with 2,000 gold, indicating an economic advantage over Team #2, after which the bet is considered played.",
      "Who will achieve more Roshan kills, tower destructions (separate markets available, including draws): A bet on the victory in the race of kills or object destructions on the map.",
      "For example: Team #1 destroyed 4 towers, and Team #2 destroyed 12 towers, in this case, the bet on Team #2's victory is considered successful. Similarly for Roshans.",
      "Map No. - First buyback: A bet on the team whose player will be the first to use the buyback option on the specified map.",
      "Map No. - Total buybacks: A bet on the number of buybacks made by both teams on the specified map.",
      "Map No. - The game will end at day/night?: A bet on what in-game cycle map will be ended.",
      "Map No. - Which team`s player will be the first to reach lvl 6: A bet on the team whose player will be the first to reach level 6 on the specified map",
      "Map No. - Specials markets: A bet on a combination of two outcomes that will occur on the specified map. A bet wins if both outcomes are settled as win."
    ]
  },
  {
    "title": "Valorant",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime or regular time depending on the name of the market;",
      "•\tOvertime: Victory on the map is achieved by winning at least 13 rounds. In a tie situation on the map (when the round score is 12:12), the tournament regulations usually provide for 2 additional rounds. Each team plays one round as Attackers and one round as Defenders. Victory in overtime is awarded to the team that wins both additional rounds. If overtime ends in a draw (both teams win 1 round each), another overtime is scheduled (2 additional rounds).",
      "•\tIn random matches, bets on the winner of the map/match will be refunded if the players of the teams decide to end in a draw based on the results of the vote."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - First Half - 1x2: А bet on the winner of the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 7 rounds.",
      "Map No. - Second half - 1x2: A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The start of the second half is the 13th round. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Odd/Even number of rounds: A bet on the odd or even number of rounds played on the specified map.",
      "Map No. - Will there be overtime: A bet on whether there will be overtime on the specified map.",
      "Map No. - Pistol round N winner: A bet on which team will win the selected pistol round on the specified map. Map No. - Total kills in pistol rounds: A bet on the total number of kills from both teams in the selected pistol round on the specified map. Map No. - Win First pistol round + Win map: A bet on a team to win the first pistol round and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Win First pistol round + Win First half: A bet on a team to win the first pistol round and the first half of the specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - Total rounds: A bet on the total number of rounds on the specified map.",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team in the match.",
      "Map No. - Team X total rounds: A bet on the total number of rounds won by the specified team on the specified map.",
      "Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total number of winning or losing rounds in the match.",
      "Map No. - Round handicap: Advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map..",
      "Map No. - Race to rounds: A bet on which team will win the selected number of rounds on the specified map first.",
      "Map No. - Asian total rounds: Asian total rounds involve betting on the total number of rounds played in a match using fractional values such as 20.25, 20.75, etc. These bets are divided into two parts, allowing for partial returns or partial losses. Examples:",
      "•\tIf a bet on over 20.25 total rounds and 21 rounds and more are played, both halves of bet win. If 20 rounds are played, half of bet (on 20) is refunded, and the other half (on 20.5) loses;",
      "•\tIf a bet on over 20.75 total rounds and 21 rounds are played, half of bet (on 20.5) wins, and the other half (on 21) is refunded. If 22 rounds and more are played, both halves of bet win.",
      "Map No. – Asian round handicap: is a type of bet used to balance the odds between two teams or players by adding or subtracting a certain number of rounds from their final score. When using quarter handicaps (e.g., -0.25 or +0.75), the bet is split into two parts: one with the nearest whole number, the other with the nearest half number, reducing the risk of a full loss. Map No. - Round handicap (3 way): A bet on which team will win a specific round with a handicap, offering three possible outcomes: Team A wins with the handicap, Team B wins with the handicap, or a tie considering the handicap. Map No. - Total Rounds (3 way): A bet on the total number of rounds played in the map, with three possible outcomes: under a specified number of rounds, over a specified number of rounds, or exactly a specified number of rounds.",
      "Map No. - First kill in round: A bet on the team that will make the first kill in the selected round.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 12:12, all outcomes are settled as losses.",
      "Map No. - Correct pistol rounds score: A bet on the exact score by pistol rounds (1st and 13th) on the specified map.",
      "Map No. - Total rounds + Win map: A bet on the total rounds and victory of the team on the specified map.",
      "Map No. - First half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - Second half correct score: A bet on the exact score by rounds on the second half on the specified map.",
      "Map No. - Will ACE be in round No.?: A bet that a player will make 5 kills (kill the entire opposing team) in the selected pistol round on the specified map.",
      "Map No. - Win First half + Win map: A bet on a team to win the first half and specified map as an overall. Both outcomes must be achieved to win.",
      "Map No. - First half - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map. Map No. - Second half - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the second half on the specified map.The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - First half - Team X Total rounds: A bet on the total number of rounds won by the specified team (Team N) in the first half on the specified map.",
      "Map No. - Second half - Team X Total rounds: A bet on the total number of rounds won by the specified team in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Second half - Total rounds: A bet on the total number of rounds played in the second half on the specified map. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Defenders total rounds: A bet on the total number of rounds the defending side will take on the specified map.",
      "Map No. - Attackers total rounds: A bet on the total number of rounds the attacking side will take on the specified map.",
      "Map No. - Winning margin: A bet on the team's victory within a certain range of rounds. Team victory on the specified map with a margin of rounds within the selected range after the map ends. Example: Team A wins 13-7. The winning margin for this result is 5-7 rounds.",
      "If overtime is required to determine the winner of the map, only winning margin 2-4 for the selected team is considered a winner.",
      "Map No. - Round No. - Method of victory: A bet on the method of victory of any of the teams in the selected round on the specified map. Victory in the round is achieved by one of the possible methods: opponent eliminated, bomb explosion/defusal, or expiration of round time without the bomb being planted.",
      "Map No. – Round No. Winner: A bet on a team to win a selected round on a specified map.",
      "Map No. - Round No. - Spike (Bomb) planted: A bet on whether the Spike (Bomb) will be planted in the selected round on the specified map.",
      "Map No. - Round No. – Total Kills: A bet on the total number of kills in the selected round on the specified map.",
      "Map No. - Round No. - Team X Total Kills: A bet on the total number of kills by Team X in the selected round on the specified map.",
      "Map No. - Total kills by player - A bet on the total number of kills by Player X on the specified map.",
      "Map No. - Total deaths by player - A bet on the total number of deaths by Player X on the specified map.",
      "Map No. - 1x2 of overtime No.: A bet on the winner of the selected overtime of the specified map with a draw. Map No. - Overtime No. - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified оvertime.",
      "Map No. - Overtime No. - Correct Score: A bet on the exact score in the specified overtime on the specified map",
      "Map No. - Overtime No. - Odd/Even number of rounds: A bet on the odd or even number of rounds in the specified overtime on the specified map.",
      "Map No. - Overtime No. - Total Rounds: A bet on the total number of rounds played in specified overtime on the specified map.",
      "Map No. - Total under + win: A bet on which team will win the map and the total number of rounds played will be less than a certain total value.",
      "Map No. - Total over + win: A bet on which team will win the map in and the total number of rounds played will be greater than a certain total value.",
      "Map No. - Player X total kills in the round: A bet on the total number of enemy kills from player N in the selected round on the specified map.",
      "Map No. - Round No. - Will be the Player X die: A bet on the player's N death in the selected round on the specified map.",
      "Map No. - Round No. - Player X make a kill: A bet on the one and more kills by Player N in the selected round on the specified map.",
      "Map No. - Will there be a double kill in the Round No.: A bet on whether any player will achieve a double kill (kill 2 enemies)in the specified round of the map. Map No. - Will there be a triple kill in the Round No.: A bet on whether any player will achieve a triple kill (kill 3 enemies) in the specified round of the map.",
      "Map No. - Round No. - Will Ace be in the round?: A bet on whether any player kills the whole enemy team in the specified round of the map.",
      "Map No. - Duel of players - Winner by kills: A bet on comparing players by the number of kills made on the specified map. In the event of an equal number of kills, bets on the market will be refunded.",
      "The market Map No. - Duel of players - 1X2 by kills provides for a bet on comparing taking into account a draw. Map No. - Duel of players - Handicap by kills: A bet on the outcome of a duel between two players with a handicap applied based on the number of kills",
      "Map No. - Total headshots: A bet on the total number of headshots (kills in head) on the specified map."
    ]
  },
  {
    "title": "League of Legends, Wild Rift",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. – Total Kills: A bet on the total number of kills made within one map. All kills made before the end of the match are considered, including kills after \"GG\" is typed in the general chat. The calculation is based on the final score of the teams in post-match statistics, meaning the bet does not account for deaths that are not credited to the opposing team - friendly unit kills, neutral creeps, suicides by abilities or items, etc. The team's kill count may differ from the total kill or death count on teams, such as when a hero dies to enemy creeps or towers, the kill is not credited to the enemy heroes but counted as a death for the player and is not considered in the calculation of the consequences of the total kills and odd/even number of kills on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - Kills Total Odd/Even: A bet on the odd or even total number of kills made by both teams within the specified map, excluding neutral kills, suicides, etc.",
      "Map No. – Race to X Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First blood: A bet on which team will make the first kill on the specified map, excluding neutral kills, suicides, etc.",
      "Map No. - First dragon: A bet on which team will achieve the first Dragon kill on the specified map.",
      "Map No. - First tower: A bet on which team will destroy the first enemy tower on the specified map.",
      "Map No. - First Baron: A bet on which team will achieve the first Baron kill on the specified map.",
      "Map No. - First inhibitor: A bet on which team will destroy the first inhibitor on the specified map.",
      "Map No. - Total dragons slain: A bet on the total number of Dragon kills by both teams on the specified map.",
      "Map No. - Towers total: A bet on the total number of destroyed towers by both teams on the specified map.",
      "Map No. - Total barons slain: A bet on the total number of Baron kills by both teams on the specified map.",
      "Map No. - Total Inhibitors destroyed: A bet on the total number of destroyed inhibitors by both teams on the specified map.",
      "Map No. - First Herald: A bet on which team will kill the Herald first on the specified map.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. - First Dragon type: A bet on the type of the first killed Dragon on the specified map.",
      "Match - Team X Total Kills: A bet on the number of kills made by one of the teams during the match.",
      "Map No. - Winner + Kills Total: A bet on the total kills and the victory of the team on the specified map.",
      "Map No. - Winner + Total kills odd/even: A bet on the winner and the odd/even kills total on the specified map.",
      "Map No. - Triple Kill: A bet that a player will kill three champions within 10 seconds of each other on the specified map.",
      "Map No. - Quadra Kill: A bet that a player will kill four champions within 10 seconds of each other on the specified map.",
      "Map No. - Team to kill first Scuttler: A bet on which team will kill the scuttler first.",
      "Map No. - Herald will be killed before 10 minutes: A bet on whether any team will kill the Herald before 10:00 min on the in-game timer on the specified map.",
      "Map No. - Both teams will kill Herald: A bet on whether both teams will kill the Herald on the specified map.",
      "Map No. - Both teams killed first 2 dragons: A bet on whether both teams will kill the first two dragons on the specified map.",
      "Map No. - Dragon steal: A bet on whether one of the teams on the specified map will steal the Dragon that the opposing team failed to kill.",
      "Map No. - Dragon Soul: A bet on whether the Dragon Soul will be taken on the specified map (killing 4 Dragons for one of the teams grants the Dragon Soul).",
      "Map No. - Baron steal: A bet on whether one of the teams on the specified map will steal the Baron that the opposing team failed to kill.",
      "Map No. - Last killed champion role: A bet on the role of the Champion killed last on the specified map.",
      "Map No. - Total kills before 10 minutes: A bet on the total number of kills made before 10 minutes, counted by the in-game timer.",
      "Map No. - Champion role with the most kills: A bet on which champion role will make the most kills on the specified map.",
      "Map No. - Which role to draw First Blood: A bet on which role will achieve the First Blood.",
      "Map No. - Which role will be killed first: A bet on which role will die at First Blood.",
      "Map No. - Total ACE: The total number of aces on the specified map (An ace is defined as killing the last living champion of the enemy team).",
      "Map No. - First tower destroyed location: A bet on which part of the map the first tower will be destroyed (bottom, middle, or top lane).",
      "Map No. - First Inhibitor destroyed location: A bet on which part of the map the first inhibitor will be destroyed (bottom, middle, or top lane).",
      "Map No. - Inhibitor respawn: A bet on whether the inhibitor will respawn on the specified map.",
      "Map No. - First tower destroyed within 13 minutes: A bet on whether the first tower will be destroyed before 13:00 min on the in-game timer on the specified map.",
      "Map No. - Elder Dragon to be slayed: A bet on whether there will be an Elder Dragon kill on the specified map.",
      "Map No. - Dragon kill handicap: The advantage or disadvantage of one of the teams, expressed in the number of dragon kills on the specified map.",
      "Map No. -Total destroyed towers odd/even: A bet on the odd or even total number of destroyed towers by both teams on the specified map",
      "Map No. - Slain the second Dragon: A bet on which team will kill the second dragon on the specified map.",
      "Map No. - Player X - Total Kills: A bet on the total number of kills by Player X on the specified map. Map No. - Player x - Total Deaths: A bet on the total number of kills by Player X on the specified map..",
      "Map No. - Baron type: A bet on which type of Baron will appear on the specified map. If the game ends before the 20:00 min on the in-game timer, the bet will be refunded.",
      "Map No. - Which team’s player will be the first to reach lvl 6: A bet on which player from which team will be the first to reach level 6 on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total kills: A bet on the total number of kills on the specified map. All kills made before the end of the match are counted, including kills after \"GG\" is typed in the general chat. Calculation is based on the final team score in the post-match statistics, so the bet does not count deaths that are not credited to the opposing team.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 min and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - First blood: A bet on which team will make the first kill on the specified map, excluding neutral kills, suicides, etc.",
      "Map No. - Race to  Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First tower: A bet on which team will destroy the first enemy tower on the specified map."
    ]
  },
  {
    "title": "Overwatch",
    "paragraphs": [
      "Map No. - Total points scored: A bet on the number of points by both teams on the specified map"
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No./Game No. - Winner: A bet on the victory of the team on the map assumes the first place occupied by the team on the specified map or game.",
      "Map No. - Team 1 will be higher in the grid than Team 2: A bet that team 1 will rank higher than team 2 on the specified map (without taking into account the number of kills).",
      "Map No. – Team X will enter the top (Yes/No): A bet on the final place of the team - above or exact (Yes) / below (No) in the specified game. Game No. - Total kills: A bet on the number of kills made by both players/teams in the specified game.",
      "Game No. - Total kills odd/even:  A bet on the odd or even number of kills made by both teams on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No.  – Will player get top (Yes/No):  A bet on a player's final place - above or exact (Yes) / below (No) in the specified game. Game No. – Total Kills: A bet on whether Player/Team N will achieve the specified number of kills – over or under in the specified game. Game No. – Odd/Even Number of Kills: A bet on the odd or even number of kills made by player in the specified game.",
      "Game No. – Winning Margin by Top/Kills: A bet on the range of values for top/kills achieved by the player/team in the specified game. Game No. – Will the Player make a Kill: A bet on whether the player will make a kill in the specified game.",
      "Game No. - Winner: A bet on the winner of the specified map.",
      "Total kills for first 5, 10 games: A bet number of kills made by Player on the specified intervals."
    ]
  },
  {
    "title": "Apex Legends",
    "paragraphs": [
      "•\tRecording of the game ending, as a clip on Twitch can be obtained upon request.",
      "•\tIn cases where the streamer exits the game through the game menu before landing on the surface, bets remain valid for the next game.",
      "•\tIf circumstances arise under which the result of the match is unknown, all bets on events for which the result has occurred up to that point will be settled according to the available results at the end of the game. All other bets will be refunded.",
      "•\tIf the streamer changes the game mode, all bets made before landing on the surface will be refunded.",
      "•\tThe company is not responsible for any actions of the streamer, bugs, or software errors in the game that affect the result.",
      "•\tIn case of stream sniping by the streamer, the company reserves the right to refund all bets on the specified game."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No.  – Will squad get top (Yes/No): A bet on the final place of the squad - above or exact (Yes) / below (No) in the specified game. Game No. – Odd/Even Number of Kills: A bet on whether the number of kills - odd or even in the specified game. Game No. – Winning Margin by Top/Kills: A bet on the range of values for top/kills achieved by the player/team in the specified game. Game No. – Will player make a kill: A bet on whether the player will make a kill in the specified game.",
      "Game No. - Will player make an assist: A bet on whether the player will make an assist in the specified game.",
      "Game No. – Total Kills: A bet on whether a player/team will achieve the specified number of kills – over or under in the specified game. Game No. – Total Assists: A bet on whether a player/team will achieve the specified number of assists – over or under in the specified game."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Game No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss."
    ]
  },
  {
    "title": "Hearthstone",
    "paragraphs": [
      "Ranked Mode:",
      "Game No. - Winner: A bet on the winner of the game with the specified sequence number. Game No. - Total Moves: A bet on the total number of moves between players in the respective game until its end. Win rate for the first 10 games: A bet on whether the player will win more or less than 50% of the games in the first 10 played.",
      "Battlefield Mode:  Game No. - Will player get top (yes/no): A bet on a player's final place - above or exact (Yes) / below (No) in the specified game."
    ]
  },
  {
    "title": "King of Glory/ Arena of Valor",
    "paragraphs": [
      "Calculation is made according to the final score in post-match statistics, meaning the bet does not take into account deaths that are not credited to the opposing team, such as finishing off with allied units, neutral creeps, suicides with abilities, or items, etc. The kill count of the team may differ from its cumulative value in the teams. For example, in the case of a hero's death from enemy creeps or towers, the kill is not credited to the enemy heroes but is credited to the enemy team. The kill is taken into account when calculating the totals of kills and even/odd number of kills on the map. This rule does not apply to markets related to player deaths."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: A bet on the number of kills made by both teams on the specified map.",
      "Map No. - Team X - Total Kills: A bet on the number of kills made by the team on the specified map.",
      "Map No. – Duration: A bet on how long a specified map will be when it ends - over or under minutes on the in-game timer. For example, to win at a bet over 36.5, the map must last at least 36:30 minutes and more. If the in-game timer stops at 36:29, the bet will be settled as a loss.",
      "Map No. - First Tower destroyed: A bet on which team will destroy the first tower on the specified map.",
      "Map No. - Total Towers destroyed: A bet on the total number of towers destroyed on the specified map",
      "Map No. - Team X Total Towers Destroyed: A bet on the number of destroyed towers of one of the teams on the specified map.",
      "Map No. - Kills handicap: The advantage or disadvantage of one of the teams, expressed in the number of team kills on the specified map.",
      "Map No. - Race to Kills: A bet on which team will achieve a certain number of kills first on the specified map. If neither team can achieve the required number of kills, the bet will be refunded.",
      "Map No. - First Blood: A bet on which team will draw first blood on the specified map.",
      "Map No. - Triple Kill: A bet on whether a triple kill will be performed consecutively by one hero on the specified map.",
      "Map No. - Individual Highest total kills: A bet on whether a player will make the highest individual kills on the specified map.",
      "Map No. - First Blood total assists: A bet on the number of assists during the first blood on the specified map.",
      "Map No. - First Pick Hero position: A bet on the position of the first hero chosen during the draft on the specified map: Jungle, Farm Line, Hard Line, Mid Lane, Support.",
      "Map No. - First Spell Choice during Draft: A bet on the first hero's spell choice during the draft on the specified map - Flash or other.",
      "Map No. - Total number of flash carried: A bet on the number of flashes used by heroes on the specified map.",
      "Map No. - Slay the first Tyrant: A bet on which team will kill the first Tyrant on the specified map.",
      "Map No. - Slay the first  shadow Tyrant: A bet on which team will kill the first Shadow Tyrant on the specified map.",
      "Map No. - Slay the first Lord of Shadows: A bet on which team will kill the first Lord of Shadows on the specified map.",
      "Map No. - Total Kills before shield of Tower Disappear: A bet on the total of kills before the tower shield disappears on the specified map. The calculation is based on the in-game timer.",
      "Map No. - Support Role total kills: A bet on the total number of kills that will be attributed to heroes playing the support role on the specified map.",
      "Map No. - Which Role to Draw First Blood: A bet on which role will make the first kill on the specified map.",
      "Map No. - First/Second Mid River Spirit Spawn location: A bet on which part of the river the River Spirit will first appear on the specified map: Lower or Upper.",
      "Map No. - Which role will be killed first: A bet on which role will die first during the first blood on the specified map.",
      "Map No. -Total Tyrant and Shadow Tyrant slayed: A bet on the total number of Tyrant and Shadow Tyrant kills by both teams during the match on the specified map.",
      "Map No. - First Tempest Dragon Spawn location: A bet on the spawn location of the first Tempest Dragon on the specified map: in the Lord of Shadows or Tyrant's lair.",
      "Map No. -Tempest Dragon slayed: A bet on which team will kill the Tempest Dragon on the specified map.",
      "Map No. - First Tower Destroyed within 5 minutes 30 seconds: A bet on whether the first tower will be destroyed on the specified map before the specified time according to the in-game timer.",
      "Map No. - First Tower Destroy location: A bet on which part of the map the first tower will be destroyed on the specified map: Bottom, Middle, or Top lane.",
      "Map No. - Total High Ground Towers destroyed: A bet on the total number of destroyed towers near the Crystal (Nexus) on both sides."
    ]
  },
  {
    "title": "Rainbow Six",
    "paragraphs": [
      "Bets on all outcomes are accepted including overtime or regular time depending on the name of the market."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - First half - 1x2: A bet on a team to win the first half on the specified map, taking into account a possible draw. To win, a team needs to win at least 4 rounds.",
      "Map No. - Second half - 1x2: A bet on the team that will win more rounds in the second half on the specified map, taking into account a possible draw. The market calculation does not depend on the final score of the map and possible overtime.",
      "Map No. - Will there be overtime: A bet on whether there will be overtime on the specified map.",
      "Total rounds: A bet on the total number of rounds played by both teams in the match",
      "Team X - Total rounds: A bet on the total number of rounds won by the specified team in the match",
      "Map No. - Team X total rounds: A bet on the specified team winning the specified number of rounds on the specified map.",
      "Rounds handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total number of winning or losing rounds in the match.",
      "Map No. - Round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds on the specified map, excluding overtime.",
      "Map No. - Race to rounds: A bet on which team will win the selected number of rounds on the specified map first.",
      "Map No. - Correct score: A bet on the exact score by rounds on the specified map. If the score on the map reaches 6:6, all outcomes are settled as losses.",
      "Map No. - First half correct score: A bet on the exact score by rounds on the first half on the specified map.",
      "Map No. - First half round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the first half on the specified map.",
      "Map No. - Second half round handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing rounds in the second half on the specified map.",
      "Map No. - Defenders total rounds: A bet on the total number of rounds the defending side will take on the specified map.",
      "Map No. - Attackers total rounds: A bet on the total number of rounds the attacking side will take on the specified map."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Total Kills: A bet on the number of kills made by both teams on the specified map.",
      "Map No. - Team N Total Kills: A bet on the number of kills made by Team N on the specified map."
    ]
  },
  {
    "title": "Rocket League",
    "paragraphs": [
      "•\tBets on all outcomes are accepted including overtime.",
      "•\tOvertime is a phase in Rocket League that triggers if the game is tied by the end of the match timer. The phase is a Sudden Death mode, where the timer runs infinitely, and the match doesn’t end until either team scores a goal, similar to the Golden Goal rule in soccer."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Map No. - Odd/Even goals: A bet on the odd or even number of goals scored on the specified map. Total goals: A bet on the total number of goals scored by both teams in the match. Team X - Total goals: A bet on the total number of goals scored by the specified team in the match Map No. - Team X total goals: A bet on the specified team scored the specified number of goals on the specified map.",
      "Goal handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the total goals scored or missed in the match.",
      "Draw no bet: A bet on the winner of a map or match without a draw. If the map or match ends in a draw, bets on the market will be returned.",
      "Map No. - Goal handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of scored or missed goals on the specified map.",
      "Map No. - Total Goals: A bet on how many goals both teams will score on the specified map",
      "Map No. - Next goal: A bet on which team will score a selected goal on the specified map first.",
      "Map No. - Correct score: A bet on the exact score of goals on the specified map."
    ]
  },
  {
    "title": "Deadlock",
    "paragraphs": [
      "Markets are settled based on the final score in the post-match statistics. To win, the team must destroy enemies' defensive buildings, push into their base, and kill the Patron."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner: A bet on the winner of the match.",
      "1x2: A bet on the winner of the match considering a draw. Offered in matches where a draw is possible (e.g., in a bo2 series).",
      "Map No. -  Winner: A bet on the winner of the selected map.",
      "Total Maps: A bet on the total number of played maps in the match.",
      "Map Handicap: A bet on the advantage or disadvantage for one of the teams, expressed in the number of winning or losing maps."
    ]
  },
  {
    "title": "Mortal Kombat",
    "paragraphs": [
      "•\tBets are accepted on various versions of the game (information about this is available during the broadcast), but only in 1vs1 format.",
      "•\tAll bets are settled after the completion of the event.",
      "•\tBets on fighters are accepted only during live betting. The game is broadcasted online on a publicly available source.",
      "•\tGame format: Best of 3 to 9 rounds; Winner is the player who achieves an unassailable number of wins (information about the number of the rounds is in the tournament name).",
      "•\tRound duration is the number of seconds elapsed from the start of the round, obtained by subtracting the final smallest number of the timer from 90 seconds (the standard round start timer). E.g., if the round timer countdown stopped at 40, the round duration is 90 - 40 = 50 seconds.",
      "•\tThe number of each individual game changes before the start of the next game on the broadcast",
      "•\tClips of a game's end can be obtained upon request on the relevant streaming resource (Twitch, Kick, YouTube, Trovo, etc.).",
      "•\tIn cases where the streamer exits the game through the game menu before the fight begins, bets remain valid for the next game.",
      "•\tDuring a fight, If one of the players exits the match the round and accordingly the game are considered won by the player who remained in the fight (even if they were in a losing position at the time one fighter exited the fight).",
      "•\tIf circumstances arise making the match result unknown, all bets on markets where results were determined will be settled according to the results available at the time the player exited; all other bets will be made void.",
      "•\tIf the streamer changes the game mode, all bets made before the fight begins will made void.",
      "•\tWe bear no responsibility for any actions of the streamer, bugs, or software errors in the game that affect the result.",
      "•\tWhere there is evidence of integrity issues including stream sniping or stream loose change (a situation where a player joins the stream and loses intentionally), we reserve the right to void all bets at our discretion."
    ]
  },
  {
    "title": "Markets",
    "paragraphs": [
      "Winner (Fight/Round): - Settled on the fighter declared the winner by knocking out the opponent (signified by the loss of all the opponent’s energy).",
      "Total rounds: - Settled on the total number of rounds fought being under or over the given line.",
      "Handicap: - Determined by which player will win the match once the specified handicap line is applied to the final round score.",
      "Round duration: - Settled on the total seconds elapsed in the round being under or over the given line.",
      "Will there be a Flawless Victory: - Settled as a victory in which the winner did not take damage from the opponent and did not harm themselves (sometimes a fighter may injure themselves while performing particularly dangerous attacks). A sign that a Flawless Victory is counted is the phrase Flawless Victory at the end of the broadcast;",
      "Will the player perform a Fatal Blow or Crushing Blow: - A Fatal Blow is a special move that deals significant damage to the opponent but becomes available only when the player's health is at 30% or below. Type of finishing moves: brutality, fatality, or none (Faction Kill counts as a fatality).   Round winner: - Winner of that specified round.  Finish Type: - Brutality, fatality, will or will not happen (Faction Kill is considered to be fatality)."
    ]
  },
  {
    "title": "E-Football",
    "paragraphs": [
      "E-Football tournaments are held on game platforms based on electronic football simulators. The rules and format of the tournaments are determined by the leagues that hold the tournaments (eRivals League, Cyber Live Arena, Esports Pro Club and others).",
      "•\tSettlement rules unless expressed below remain the same as our football rules.",
      "•\tBets on e-football matches are accepted based on the regular game time and added injury time added by the virtual referee unless specified.",
      "•\tFor competitions where extra time and/or penalty shootouts occur, these markets are priced and resulted separately to the regular time markets",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf the event is interrupted, bets are voided, with the exception of bets whose results are clearly determined before the event is stopped and have already been calculated",
      "•\tAll bets are settled after the actual conclusion of the event.",
      "•\tThe number of substitutions is not limited, the composition of the players for the teams can be any amount.",
      "•\tE-Football Rules apply to the following tournaments: EAFC 24. 2x4 min., Volta Rush. EAFC 24, Volta Football League. EAFC 24.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "EAFC 24",
    "paragraphs": [
      "•\tThis is a game mode in the FIFA football simulator in which players, whose teams consist of 11 players from each side, play against each other on a virtual football field.",
      "•\tDuration of regular time: 8 minutes (2 halves of 4 minutes each).",
      "•\tGame format: 11x11 players.",
      "•\tFor certain tournament formats in the event of a draw at the end of regular time, additional periods (Extra Time) and a series of post-match penalties are provided."
    ]
  },
  {
    "title": "Volta Rush & Volta Football League. EAFC 24",
    "paragraphs": [
      "•\tA game mode in EAFC 24 Football Simulator where players play against each other on a small virtual football pitch, a street-style pitch.",
      "•\tMatch duration: 6 minutes (2 halves of 3 minutes each).",
      "•\tGame format: determined by the leagues organizing the tournaments, can be 3x3 or 4x4 (information about the game format is indicated in the tournament's name).",
      "•\tLevel of difficulty: determined by the leagues holding the tournaments",
      "•\tStadium for the game: determined by the leagues organizing the tournaments."
    ]
  },
  {
    "title": "E-Basketball",
    "paragraphs": [
      "•\tE-Basketball is a virtual computer simulation of a live match, or with the participation of professional E-Basketball players.",
      "•\tMatches are played with 4 quarters of 4, 5, 6, 10, or 12 minutes (duration of the quarter specified in the tournament name), overtime of 3 minutes\".",
      "•\tDifficulty level: \"Hall of Fame\".",
      "Available main market types include:",
      "•\tWin including overtime",
      "•\tHandicap including overtime",
      "•\tTotal including overtime (over/under)",
      "•\tIndividual player totals including overtime (over/under)",
      "•\tQuarter winner",
      "•\tQuarter handicap",
      "•\tQuarter total (over/under)",
      "•\tIndividual player quarter totals (over/under)",
      "•\tStatistical Markets (2 or 3 point shots made)  - 1x2 (Match/Quarter) Which Team will have the most 2/3 point shots made, includes Overtime period. - Total Over/Under (Match/Quarter) 2/3 point shots made. - Handicap (Match/Quarter): Bet on the team to win the match by the number of 2 or 3 point shots, if the specified handicap is applied to the total number of shots made. - Total Away / Home (Match/Quarter): The total number of 2-point or 3-point shots scored in a match or in a certain quarter by a certain team. It is necessary to predict whether the result will be greater or less than a certain total for that team.         - Odd/Even (Match/Quarter): Bet on whether the total number of 2-point or 3-point shots scored in a match or in a given quarter will be even or odd.",
      "•\tIf an event is recreated with new data, times or teams, previous bets will be void.",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "Streetball",
    "paragraphs": [
      "•\tStreetball esports is one of the game variants of NBA2K basketball simulator.",
      "•\tGame can be played in various formats: 1x1, 2x2, 3x3, 4x4, and 5x5 (information about the game format is indicated in the tournament's name).",
      "•\tDifficulty level: \"Hall of Fame\"",
      "•\tRoster (parameters and strength of participants): \"Official\" at the start of the event (if the game is played in formats 2x2, 3x3, 4x4, and 5x5, the match involves the strongest players from participating teams).",
      "•\tThe game is played on one hoop up to 11 points.",
      "•\tEach successful shot inside the six-meter line (6.2 meters) or from the penalty line earns the team/player 1 point.",
      "•\tA shot beyond the six-meter line earns 2 points.",
      "•\tIf one participant/team reaches 10 points and the score difference is less than 2 points, the game continues until the score difference becomes more than 1 point.",
      "•\tAvailable bet types include:",
      "•\tWin",
      "•\tHandicap",
      "•\tTotal (over/under)",
      "•\tEven/Odd total",
      "•\tIndividual player/team totals (over/under)",
      "•\tRace to points",
      "•\tVictory in the draw (which player/team will score point #1, #2, #3, etc.).",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "E-Tennis",
    "paragraphs": [
      "•\tE-Tennis is a virtual tennis competition simulated by a computer program (imitation of a real match using the game \"AO Tennis\" or \"Tennis World Tour 2\"; information about the game is in the name of the tournament). The game model is formed by artificial intelligence, which is responsible for the results of the matches.",
      "•\tMarket rules are the same as Tennis rules for market settlement.",
      "•\tMatches may consist of 1, 3, or 5 sets depending on the match or tournament format (information is in the tournament name).",
      "•\tIf a court change occurs including a surface change, bets will remain valid.",
      "•\tAvailable market types:",
      "•\tHandicap",
      "•\tTotal (over/under)",
      "•\tIndividual totals (over/under)",
      "•\tExact score",
      "•\tEven/odd total",
      "•\tGame winner",
      "•\tPlayer win + total games",
      "•\tAll matches are broadcasted online via Video Stream. If an event is interrupted or video coverage is dropped, all unsettled bets will stand and be settled per the result providing one is available, if it is not available, only then will bets be voided.",
      "•\tIf a match is interrupted due to technical reasons (computer crash, connection loss, etc.), unsettled bets are void.",
      "•\tIf an event is restarted or replayed due to a technical failure, this will count as a new event."
    ]
  },
  {
    "title": "E-Ice Hockey",
    "paragraphs": [
      "•\tE Ice Hockey is a virtual hockey competition with the participation of professional players.",
      "•\tThe rules are the same as those in real hockey games. The length of the period is indicated in the name of the tournament.",
      "•\tAll match markets are settled in regular time (competition specific) unless otherwise stated.",
      "•\tIn the event of a scheduled event being postponed or abandoned, all bets will be void unless the match resumes within 48 hours of the event time, unless an official winner is announced by the governing competition body.",
      "•\tGoals scored in overtime are not counted for markets related to the 3rd period or regular time.",
      "•\tAvailable Markets:",
      "- Winner/moneyline (Match/Period): The team which officially wins the match or specified period. Bets on the match moneyline are settled on the winner of the game, including overtime and shootout. - 1x2 (Match/Period): The team that will be the official winner in the match or in a certain period. It is calculated based on the result of regular time only, excluding overtime. - Total (Match/Period): Total number of goals scored in a match or period. The calculation of the bet is determined by whether the result will be more or less than the offered amount. - Handicap (Match/Period): Bet on the team to win the match if the specified handicap is applied to the total score of the match or a certain period. - Total Away / Home (Match/Period): Total number of goals scored in a match or in a certain period by a certain team. It is necessary to predict whether the result will be greater or less than a certain limit. - Double Chance (Match/Period): You need to predict the official result of a match or a certain period included in the prediction, where two out of three possible options will be winning and one will be losing. - Bet to win without a draw (Match/Period): Bet on the winner of the game in regular time or in a certain period. If the game ends in a draw, bets are void. - Exact Score (Match/Period): Bet on the exact prediction of the final score in a match or specified period. - Xth Goal (Match/Period): You need to predict which team will score a goal with the specified number in the specified period. - Both Teams to Score (Match/Period): Bet on whether both teams will score at least one goal in regular time of the match or in the specified period. - Odd/Even (Match/Period): Bet on whether the total number of goals scored in a match or period will be odd or even."
    ]
  },
  {
    "title": "Cash Out Rules",
    "paragraphs": [
      "•\tCash-out is the feature through which the user can request an early settlement of their bet (before the completion of the sporting event) for a stated return.",
      "•\tCash-out is offered only for the bet type - Single. For various markets, matches or competitions; the option may not be offered or temporarily suspended by the company.",
      "•\tCash-out can be used at any time after placing the bet whilst the sale option is available for this bet. In some cases, the sale option for the bet may be unavailable for various technical reasons (lack of match broadcasting capability, technical errors in score display, etc.), but its operation may be restored later.",
      "•\tTo sell a bet, you must be a registered user and logged in to your account. The option is available in the sections of the website \"Coupon - My Bets\" and \"Profile - Bet History.\" When opening the details of the bet, you need to press the \"Cash-out\" button at the bottom of your bet.",
      "•\tThe amount to be returned is displayed in the bet coupon in the \"Cash-out\" line. The amount may vary continually and is calculated separately for each specific bet.",
      "•\tDelays may occur when processing a cash-out request. The cash-out request may be unsuccessful if the selection was not available to bet on (suspended or closed) or if the amount to be returned has been recalculated during the request process.",
      "•\tThe proposed cash-out amount at any given time is the amount that will be returned to your account if the request is successful.",
      "•\tThe Organizer reserves the right to cancel the cash-out option in the following cases:",
      "•\tThe cash-out amount was displayed incorrectly.",
      "•\tThe request was made after the result of the event on which the bet was placed became known.",
      "•\tIf the bet or result was settled erroneously.",
      "•\tIf cash-out participated in bonuses or promotions.",
      "•\tIn case of cancellation of the bet sale option, settlement will be made according to the result of the sporting event on which the bet was placed.",
      "•\tThe Organizer reserves the right to change the conditions or not offer the cash-out option without explaining the reasons and without giving prior notice."
    ]
  },
  {
    "title": "Single Bet",
    "paragraphs": [
      "A single bet or straight bet is a bet on a single selection within a single event. It is the simplest type of bet, where your selection must win to receive a return."
    ]
  },
  {
    "title": "Accumulator / Combo Bet",
    "paragraphs": [
      "A bet with selections made on two or more different events combined into a single staked bet. The odds are calculated by multiplying the odds of all the selections together. All selections must win for you to receive a return."
    ]
  },
  {
    "title": "System Bets / Permutations",
    "paragraphs": [
      "A bet with selections from three or more different events. You have the option to them combine these selections into a multiple of smaller bets with all possible combinations of accumulator bets possible.",
      "This is calculated depending on the number of selections you add to the betslip, for example if you add 3 selections, then there are 3 combinations of doubles available (A+B, A+C, B+C). The stake is then selected and spread evenly between the number of possible combinations within the bet. To receive a partial pay out, in this example 2 selections must win to receive a return. The maximum return will be paid if all three selections win.  Please be aware that it is possible for your return to be less than your initial stake depending on pricing and number of selections added into the system bet."
    ]
  },
  {
    "title": "Placing bets from the bonus balance",
    "paragraphs": [
      "•\tWhen placing bets from the bonus balance, the terms and conditions for wagering the active bonus apply.",
      "•\tStakes made with bonus balance will not be calculated in the overall return.",
      "•\tIf a bet was placed from an bonus balance which expired before the bet settlement, then this bet will be considered void, and further settlements will not be made.",
      "•\tEach player has two balances - real and bonus. Initially, bets are placed using their real balance. Only when the sum in the player's real account equals zero does the player start playing with bonus money. All winnings obtained while playing with bonus money are credited to the player's bonus balance.",
      "•\tIf a bet is made from a bonus balance that has been subsequently played through (converted into real funds), no further settlements will be made for such a bet.",
      "•\tIf a player, for any reason, does not wish to use bonus funds, they may place bets exclusively with real funds without involving bonuses. The current amount of available real funds is always accessible to the player after clicking on the balance at the top of the screen"
    ]
  }
];
