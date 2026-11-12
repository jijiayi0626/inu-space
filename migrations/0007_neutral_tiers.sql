-- 会员等级 key 改为中性命名，兼容旧数据。
UPDATE users SET member_tier = CASE member_tier
  WHEN 'stardust' THEN 'basic'
  WHEN 'planet' THEN 'silver'
  WHEN 'star' THEN 'gold'
  WHEN 'galaxy' THEN 'platinum'
  ELSE member_tier
END;
