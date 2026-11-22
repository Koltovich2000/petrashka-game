export const worldTables=`
 CREATE TABLE IF NOT EXISTS petrashka_pauses (started_at BIGINT PRIMARY KEY, ends_at BIGINT);
 CREATE TABLE IF NOT EXISTS petrashka_polls (
  id TEXT PRIMARY KEY, question TEXT NOT NULL, options TEXT NOT NULL, started_at BIGINT NOT NULL, ends_at BIGINT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS petrashka_votes (
  poll_id TEXT NOT NULL, player_id TEXT NOT NULL, choice INTEGER NOT NULL,
  PRIMARY KEY(poll_id,player_id)
 )`;

const lastPoll='SELECT * FROM petrashka_polls ORDER BY started_at DESC, id DESC LIMIT 1';
const activePause='SELECT started_at FROM petrashka_pauses WHERE ends_at IS NULL';
const countVotes='SELECT choice, COUNT(*) AS votes FROM petrashka_votes WHERE poll_id=? GROUP BY choice';

function pausePeriods(rows){
 return rows.map(row=>({start:Number(row.started_at),end:row.ends_at===null?null:Number(row.ends_at)}));
}

export function worldStore(query,transaction){
 return {
  snapshot(clock){
   return transaction(function* (){
    const now=clock();
    const rows=yield ['SELECT started_at,ends_at FROM petrashka_pauses ORDER BY started_at'];
    return {now,pauses:pausePeriods(rows)};
   },true);
  },
  async poll(now,playerId,admin=false){
   const [poll]=await query(lastPoll,[]);
   if(!poll)return null;
   const options=JSON.parse(poll.options);
   const [vote]=playerId?await query('SELECT choice FROM petrashka_votes WHERE poll_id=? AND player_id=?',[poll.id,playerId]):[];
   const endsAt=Number(poll.ends_at);
   let counts=null;
   if(admin||vote||endsAt<=now){
    counts=options.map(()=>0);
    for(const row of await query(countVotes,[poll.id]))counts[row.choice]=Number(row.votes);
   }
   return {id:poll.id,question:poll.question,options,endsAt,choice:vote?.choice??null,counts};
  },
  async setPause(paused,clock){
   // The adapter locks world mutations before any read or write.
   return transaction(function* (){
    const now=clock();
    const [active]=yield [activePause];
    if(paused&&!active){
     const [last]=yield ['SELECT MAX(ends_at) AS latest FROM petrashka_pauses'];
     const start=Math.max(now,Number(last.latest)||0);
     yield ['INSERT INTO petrashka_pauses (started_at) VALUES (?) ON CONFLICT(started_at) DO UPDATE SET ends_at=NULL',start];
    }
    if(!paused&&active){
     yield ['UPDATE petrashka_pauses SET ends_at=? WHERE started_at=?',Math.max(now,Number(active.started_at)),active.started_at];
    }
   });
  },
  async createPoll(command,clock){
   return transaction(function* (){
    const now=clock();
    const options=JSON.stringify(command.options);
    const [same]=yield ['SELECT question,options,started_at,ends_at FROM petrashka_polls WHERE id=?',command.id];
    if(same){
     return same.question===command.question&&same.options===options&&Number(same.ends_at)-Number(same.started_at)===command.duration;
    }
    const [active]=yield [lastPoll];
    if(active&&Number(active.ends_at)>now)return false;
    yield ['INSERT INTO petrashka_polls VALUES (?,?,?,?,?)',command.id,command.question,options,now,now+command.duration];
    return true;
   });
  },
  async vote(playerId,pollId,choice,clock){
   return transaction(function* (){
    const now=clock();
    const [poll]=yield ['SELECT options,ends_at FROM petrashka_polls WHERE id=?',pollId];
    if(!poll||Number(poll.ends_at)<=now||choice>=JSON.parse(poll.options).length)return false;
    yield ['INSERT INTO petrashka_votes VALUES (?,?,?) ON CONFLICT(poll_id,player_id) DO NOTHING',pollId,playerId,choice];
    return true;
   });
  },
 };
}
