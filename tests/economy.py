import sqlite3, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class Economy(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  for f in sorted((ROOT/'migrations').glob('*.sql')): self.db.executescript(f.read_text())
  self.db.execute("INSERT INTO users(id,email,name,password,salt) VALUES('u','u@x.com','Teste','hash','salt')")
  self.db.execute("INSERT INTO ledger VALUES('start','u',1000,'Start',CURRENT_TIMESTAMP)")
 def balance(self):return self.db.execute("SELECT balance FROM users WHERE id='u'").fetchone()[0]
 def bet(self,id='b',stake=100):self.db.execute("INSERT INTO bets(id,user_id,event_id,outcome_id,stake,odds) VALUES(?,'u','arena-01','kaito',?,180)",(id,stake))
 def test_bet_win_and_repeat_settlement(self):
  self.bet();self.assertEqual(self.balance(),900)
  self.db.execute("UPDATE events SET status='settled',winner='kaito' WHERE id='arena-01'");self.assertEqual(self.balance(),1080)
  self.db.execute("UPDATE events SET status='settled' WHERE id='arena-01'");self.assertEqual(self.balance(),1080)
 def test_insufficient_rolls_back(self):
  with self.assertRaises(sqlite3.IntegrityError):self.bet(stake=1100)
  self.assertEqual(self.balance(),1000);self.assertEqual(self.db.execute('SELECT count(*) FROM bets').fetchone()[0],0)
 def test_void_refund(self):
  self.bet();self.db.execute("UPDATE events SET status='void' WHERE id='arena-01'");self.assertEqual(self.balance(),1000)
 def test_daily_duplicate(self):
  self.db.execute("INSERT INTO daily VALUES('u','2026-10-09')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO daily VALUES('u','2026-10-09')")
  self.assertEqual(self.balance(),1100)
 def test_bonus_limit_and_duplicate(self):
  self.db.execute("INSERT INTO claims VALUES('c','u','UMBRELLA500')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO claims VALUES('c2','u','UMBRELLA500')")
  self.assertEqual(self.balance(),1500)
  self.db.execute("UPDATE bonuses SET max_uses=1 WHERE code='UMBRELLA500'")
  self.db.execute("INSERT INTO users(id,email,name,password,salt) VALUES('v','v@x.com','V','h','s')")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO claims VALUES('c3','v','UMBRELLA500')")
 def test_reward_refund_once(self):
  self.db.execute("INSERT INTO redemptions(id,user_id,reward_id,title,cost) VALUES('r','u','badge','Insígnia Fundador',1000)")
  self.assertEqual(self.balance(),0)
  self.db.execute("UPDATE redemptions SET status='cancelled' WHERE id='r'");self.assertEqual(self.balance(),1000)
  self.db.execute("UPDATE redemptions SET status='cancelled' WHERE id='r'");self.assertEqual(self.balance(),1000)
 def test_closed_and_odds_tamper(self):
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO bets(id,user_id,event_id,outcome_id,stake,odds) VALUES('b','u','arena-01','kaito',100,900)")
  self.db.execute("UPDATE events SET closes='2020-01-01' WHERE id='arena-01'")
  with self.assertRaises(sqlite3.IntegrityError):self.bet()
 def test_reward_stock_and_balance_rollback(self):
  self.db.execute("UPDATE rewards SET cost=2000 WHERE id='badge'")
  with self.assertRaises(sqlite3.IntegrityError):self.db.execute("INSERT INTO redemptions(id,user_id,reward_id,title,cost) VALUES('r','u','badge','Insígnia Fundador',2000)")
  self.assertEqual(self.db.execute("SELECT stock FROM rewards WHERE id='badge'").fetchone()[0],100)
if __name__=='__main__':unittest.main()
