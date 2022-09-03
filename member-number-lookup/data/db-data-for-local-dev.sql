CREATE DATABASE IF NOT EXISTS makespace;
USE makespace;

DROP TABLE IF EXISTS `InductionFormResponse`;
CREATE TABLE `InductionFormResponse` (
  `idInductionFormResponse` int(11) NOT NULL AUTO_INCREMENT,
  `Given_Member_Number` int(11) DEFAULT NULL COMMENT 'The member number given to the inductee, typically attached to the keyfob.',
  `Member_Email` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`idInductionFormResponse`),
  UNIQUE KEY `idInductionFormResponse_UNIQUE` (`idInductionFormResponse`)
) ENGINE=InnoDB AUTO_INCREMENT=14586 DEFAULT CHARSET=utf8 COMMENT='Raw responses from member induction Google Form.';

INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (42, 'douglas.adams@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (1337, 'foo@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (10, 'Uppercase@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (11, 'lowercase@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (90, 'duplicate@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (91, 'duplicate@example.com');