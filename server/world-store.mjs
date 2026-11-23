export const worldTables=`
 CREATE TABLE IF NOT EXISTS petrashka_pauses (started_at BIGINT PRIMARY KEY, ends_at BIGINT);
 CREATE TABLE IF NOT EXISTS petrashka_polls (
  id TEXT PRIMARY KEY, question TEXT NOT NULL, options TEXT NOT NULL, started_at BIGINT NOT NULL, ends_at BIGINT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS petrashka_poll_control (
  poll_id TEXT PRIMARY KEY REFERENCES petrashka_polls(id), pause_started_at BIGINT, closed_at BIGINT
 );
 CREATE TABLE IF NOT EXISTS petrashka_removed_polls (
  poll_id TEXT PRIMARY KEY REFERENCES petrashka_polls(id)
 );
 CREATE TABLE IF NOT EXISTS petrashka_votes (
  poll_id TEXT NOT NULL, player_id TEXT NOT NULL, choice INTEGER NOT NULL,
  PRIMARY KEY(poll_id,player_id)
 )`;

const lastPoll=`SELECT p.*, c.poll_id AS control_id, c.pause_started_at, c.closed_at, r.poll_id AS removed_id
 FROM petrashka_polls p LEFT JOIN petrashka_poll_control c ON c.poll_id=p.id
 LEFT JOIN petrashka_removed_polls r ON r.poll_id=p.id
 ORDER BY p.started_at DESC, CASE WHEN c.closed_at IS NULL THEN 0 ELSE 1 END, p.id DESC LIMIT 1`;
const activePause='SELECT started_at FROM petrashka_pauses WHERE ends_at IS NULL';
const countVotes='SELECT choice, COUNT(*) AS votes FROM petrashka_votes WHERE poll_id=? GROUP BY choice';

function pausePeriods(rows){
 return rows.map(row=>({start:Number(row.started_at),end:row.ends_at===null?null:Number(row.ends_at)}));
}

const deadline=poll=>Number(poll.closed_at??poll.ends_at);
const sharesPause=(poll,pause)=>Boolean(poll&&!poll.removed_id&&pause&&(poll.control_id
 ?poll.pause_started_at!==null&&Number(poll.pause_started_at)===Number(pause.started_at)
 :Number(poll.started_at)>=Number(pause.started_at)));

function* closePause(pause,at){
 yield ['UPDATE petrashka_pauses SET ends_at=? WHERE started_at=?',at,pause.started_at];
}

function* settleWorld(now){
 const [poll]=yield [lastPoll];
 let [pause]=yield [activePause];
 if(sharesPause(poll,pause)&&poll.closed_at==null&&deadline(poll)<=now){
  // A poll's wall-clock deadline releases its pause even if nobody was online then.
  yield* closePause(pause,deadline(poll));
  pause=undefined;
 }
 return {poll,pause};
}

export function worldStore(transaction){
 return {
  snapshot(clock,playerId,admin=false){
   return transaction(function* (){
    const now=clock();
    const world=yield* settleWorld(now);
    const rows=yield ['SELECT started_at,ends_at FROM petrashka_pauses ORDER BY started_at'];
    const snapshot={now,pauses:pausePeriods(rows),poll:null};
    const poll=world.poll;
    if(!poll||poll.removed_id||!playerId)return snapshot;
    const options=JSON.parse(poll.options);
    const [vote]=yield ['SELECT choice FROM petrashka_votes WHERE poll_id=? AND player_id=?',poll.id,playerId];
    const endsAt=deadline(poll);
    const counts=options.map(()=>0);
    for(const row of yield [countVotes,poll.id])counts[row.choice]=Number(row.votes);
    snapshot.poll={id:poll.id,question:poll.question,options,endsAt,choice:vote?.choice??null,
     counts:admin||vote||endsAt<=now?counts:null,totalVotes:counts.reduce((sum,value)=>sum+value,0)};
    return snapshot;
   });
  },
  async setPause(paused,clock){
   // The adapter locks world mutations before any read or write.
   return transaction(function* (){
    const now=clock();
    const {poll,pause:active}=yield* settleWorld(now);
    if(paused&&!active){
     const [last]=yield ['SELECT MAX(ends_at) AS latest FROM petrashka_pauses'];
     const start=Math.max(now,Number(last.latest)||0);
     yield ['INSERT INTO petrashka_pauses (started_at) VALUES (?) ON CONFLICT(started_at) DO UPDATE SET ends_at=NULL',start];
    }
    if(!paused&&active){
     const resumedAt=Math.max(now,Number(active.started_at));
     if(sharesPause(poll,active)&&deadline(poll)>resumedAt){
      yield [`INSERT INTO petrashka_poll_control (poll_id,pause_started_at,closed_at) VALUES (?,?,?)
       ON CONFLICT(poll_id) DO UPDATE SET closed_at=excluded.closed_at`,poll.id,active.started_at,resumedAt];
     }
     yield* closePause(active,resumedAt);
    }
   });
  },
  async createPoll(command,clock){
   return transaction(function* (){
    const now=clock();
    const {poll,pause}=yield* settleWorld(now);
    const options=JSON.stringify(command.options);
    const [same]=yield ['SELECT question,options,started_at,ends_at FROM petrashka_polls WHERE id=?',command.id];
    if(same){
     return same.question===command.question&&same.options===options&&Number(same.ends_at)-Number(same.started_at)===command.duration;
    }
    if(poll&&!poll.removed_id&&deadline(poll)>now)return false;
    // Keep the new poll ahead of a predecessor removed or closed in the same millisecond.
    const startedAt=Math.max(now,Number(poll?.started_at??-1)+1);
    yield ['INSERT INTO petrashka_polls VALUES (?,?,?,?,?)',command.id,command.question,options,startedAt,startedAt+command.duration];
    yield ['INSERT INTO petrashka_poll_control (poll_id,pause_started_at) VALUES (?,?)',command.id,pause?.started_at??null];
    return true;
   });
  },
  async removePoll(id,clock){
   return transaction(function* (){
    yield* settleWorld(clock());
    // Keep the newest poll as the record of what was published, so deleting it cannot reveal an older result.
    yield [`INSERT INTO petrashka_removed_polls (poll_id) SELECT id FROM petrashka_polls WHERE id=?
     ON CONFLICT(poll_id) DO NOTHING`,id];
   });
  },
  async vote(playerId,pollId,choice,clock){
   return transaction(function* (){
    const now=clock();
    const {poll}=yield* settleWorld(now);
    if(!poll||poll.removed_id||poll.id!==pollId||deadline(poll)<=now||choice>=JSON.parse(poll.options).length)return false;
    yield ['INSERT INTO petrashka_votes VALUES (?,?,?) ON CONFLICT(poll_id,player_id) DO NOTHING',pollId,playerId,choice];
    return true;
   });
  },
 };
}
