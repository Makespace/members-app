CREATE DATABASE IF NOT EXISTS makespace;
USE makespace;

DROP TABLE IF EXISTS `Members`;
CREATE TABLE `Members` (
  `idMembers` int(11) NOT NULL AUTO_INCREMENT,
  `Member_Number` int(11) NOT NULL COMMENT 'Canonical Makespace Member number.',
  `Access_Level` int(11) NOT NULL DEFAULT '1' COMMENT 'Default access level is Zero.',
  `Notes` longtext COMMENT 'Free-form notes.',
  `Reason_For_Leaving` int(11) DEFAULT NULL COMMENT 'Reason why this member left Makespace.',
  PRIMARY KEY (`idMembers`),
  UNIQUE KEY `idMembers_UNIQUE` (`idMembers`),
  UNIQUE KEY `Member_Number_UNIQUE` (`Member_Number`),
  KEY `LevelOfAccess_idx` (`Access_Level`),
  KEY `ReasonForLeavingMakesapce_idx` (`Reason_For_Leaving`),
  CONSTRAINT `LevelOfAccess` FOREIGN KEY (`Access_Level`) REFERENCES `AccessLevel` (`idAccessLevel`) ON UPDATE NO ACTION,
  CONSTRAINT `ReasonForLeavingMakesapce` FOREIGN KEY (`Reason_For_Leaving`) REFERENCES `LeavingReasons` (`idLeavingReasons`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=105530 DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `InductionFormResponse`;
CREATE TABLE `InductionFormResponse` (
  `idInductionFormResponse` int(11) NOT NULL AUTO_INCREMENT,
  `Given_Member_Number` int(11) DEFAULT NULL COMMENT 'The member number given to the inductee, typically attached to the keyfob.',
  `Member_Email` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`idInductionFormResponse`),
  UNIQUE KEY `idInductionFormResponse_UNIQUE` (`idInductionFormResponse`)
) ENGINE=InnoDB AUTO_INCREMENT=14586 DEFAULT CHARSET=utf8 COMMENT='Raw responses from member induction Google Form.';

DROP TABLE IF EXISTS `InductionRecord`;
CREATE TABLE `InductionRecord` (
  `idInductionRecord` int(11) NOT NULL AUTO_INCREMENT,
  `Member` int(11) NOT NULL COMMENT 'The member being inducted.',
  `Inducted_By` int(11) DEFAULT NULL COMMENT 'Member inducting new member.',
  `Date_Of_Induction` date NOT NULL,
  `Induction_Form` int(11) DEFAULT NULL,
  PRIMARY KEY (`idInductionRecord`),
  UNIQUE KEY `idInductionRecord_UNIQUE` (`idInductionRecord`),
  KEY `InductorMember_idx` (`Inducted_By`),
  KEY `InducteeMember_idx` (`Member`),
  KEY `FormResponse_idx` (`Induction_Form`),
  CONSTRAINT `FormResponse` FOREIGN KEY (`Induction_Form`) REFERENCES `InductionFormResponse` (`idInductionFormResponse`) ON UPDATE NO ACTION,
  CONSTRAINT `InducteeMember` FOREIGN KEY (`Member`) REFERENCES `Members` (`idMembers`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `InductorMember` FOREIGN KEY (`Inducted_By`) REFERENCES `Members` (`idMembers`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=10027 DEFAULT CHARSET=utf8 COMMENT='Details captured during induction.';

DROP TABLE IF EXISTS `RecurlyAccounts`;
CREATE TABLE `RecurlyAccounts` (
  `idRecurlyAccounts` int(11) NOT NULL AUTO_INCREMENT,
  `Account_Code` varchar(256) DEFAULT NULL COMMENT 'Unique code to associate member with account on Recurly.',
  `Username` varchar(256) DEFAULT NULL,
  `Email` varchar(128) NOT NULL,
  `First_Name` varchar(128) NOT NULL,
  `Last_Name` varchar(128) NOT NULL,
  `Company_Name` varchar(128) DEFAULT NULL,
  `Created_At` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idRecurlyAccounts`),
  UNIQUE KEY `idRecurlySubscriptions_UNIQUE` (`idRecurlyAccounts`)
) ENGINE=InnoDB AUTO_INCREMENT=84349 DEFAULT CHARSET=utf8;

DROP TABLE IF EXISTS `MemberRecurlyAccount`;
CREATE TABLE `MemberRecurlyAccount` (
  `idMemberRecurlyAccount` int(11) NOT NULL AUTO_INCREMENT,
  `Member` int(11) NOT NULL,
  `RecurlyAccount` int(11) NOT NULL,
  `Checked_By` int(11) DEFAULT NULL COMMENT 'Member performing the linking.',
  PRIMARY KEY (`idMemberRecurlyAccount`),
  UNIQUE KEY `idMemberRecurlyAccount_UNIQUE` (`idMemberRecurlyAccount`),
  KEY `Member_FK_idx` (`Member`),
  KEY `Checked_FK_idx` (`Checked_By`),
  KEY `Recurly_FK_idx` (`RecurlyAccount`),
  CONSTRAINT `Checked_FK` FOREIGN KEY (`Checked_By`) REFERENCES `Members` (`idMembers`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `Member_FK` FOREIGN KEY (`Member`) REFERENCES `Members` (`idMembers`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `Recurly_FK` FOREIGN KEY (`RecurlyAccount`) REFERENCES `RecurlyAccounts` (`idRecurlyAccounts`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3665 DEFAULT CHARSET=utf8 COMMENT='Link between member and Recurly account';


INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (42, 'douglas.adams@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (1337, 'foo@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (10, 'Uppercase@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (11, 'lowercase@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (90, 'duplicate@example.com');
INSERT INTO `InductionFormResponse` (`Given_Member_Number`, `Member_Email`) VALUES (91, 'duplicate@example.com');
