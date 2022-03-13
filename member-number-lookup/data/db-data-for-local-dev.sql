CREATE DATABASE IF NOT EXISTS makespace;
USE makespace;

CREATE TABLE `InductionFormResponse` (
  `idInductionFormResponse` int(11) NOT NULL AUTO_INCREMENT,
  `Given_Member_Number` int(11) DEFAULT NULL COMMENT 'The member number given to the inductee, typically attached to the keyfob.',
  `Member_Email` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`idInductionFormResponse`),
  UNIQUE KEY `idInductionFormResponse_UNIQUE` (`idInductionFormResponse`)
) ENGINE=InnoDB AUTO_INCREMENT=14586 DEFAULT CHARSET=utf8 COMMENT='Raw responses from member induction Google Form.';
