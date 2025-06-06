import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGameSchema1749122162737 implements MigrationInterface {
    name = 'CreateGameSchema1749122162737'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "guess" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guess" character varying NOT NULL, "isCorrect" boolean NOT NULL DEFAULT false, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "roundId" uuid, "playerId" uuid, CONSTRAINT "PK_3a695f50b71c117a9fb5b8ff67c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "round" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "word" character varying NOT NULL, "revealedTiles" boolean array NOT NULL, "roundNumber" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "endedAt" TIMESTAMP, "matchId" uuid, "winnerId" uuid, CONSTRAINT "PK_34bd959f3f4a90eb86e4ae24d2d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."match_status_enum" AS ENUM('ongoing', 'completed')`);
        await queryRunner.query(`CREATE TABLE "match" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "score1" integer NOT NULL DEFAULT '0', "score2" integer NOT NULL DEFAULT '0', "status" "public"."match_status_enum" NOT NULL DEFAULT 'ongoing', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "player1Id" uuid, "player2Id" uuid, CONSTRAINT "PK_92b6c3a6631dd5b24a67c69f69d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "player" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "totalWins" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_331aaf0d7a5a45f9c74cc699ea8" UNIQUE ("username"), CONSTRAINT "PK_65edadc946a7faf4b638d5e8885" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "guess" ADD CONSTRAINT "FK_504518ad34d74486db45d9d4c30" FOREIGN KEY ("roundId") REFERENCES "round"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "guess" ADD CONSTRAINT "FK_74411ac28b258fc167306a4dd05" FOREIGN KEY ("playerId") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "round" ADD CONSTRAINT "FK_7f3ebe2c9b6582d68973dd1de22" FOREIGN KEY ("matchId") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "round" ADD CONSTRAINT "FK_c2bf47a4bdb61883949ae484e99" FOREIGN KEY ("winnerId") REFERENCES "player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_7ecd38eb2baa65327de8fc6021f" FOREIGN KEY ("player1Id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_d1f05e5fc2a7f92e29c8e3c8e0f" FOREIGN KEY ("player2Id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_d1f05e5fc2a7f92e29c8e3c8e0f"`);
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_7ecd38eb2baa65327de8fc6021f"`);
        await queryRunner.query(`ALTER TABLE "round" DROP CONSTRAINT "FK_c2bf47a4bdb61883949ae484e99"`);
        await queryRunner.query(`ALTER TABLE "round" DROP CONSTRAINT "FK_7f3ebe2c9b6582d68973dd1de22"`);
        await queryRunner.query(`ALTER TABLE "guess" DROP CONSTRAINT "FK_74411ac28b258fc167306a4dd05"`);
        await queryRunner.query(`ALTER TABLE "guess" DROP CONSTRAINT "FK_504518ad34d74486db45d9d4c30"`);
        await queryRunner.query(`DROP TABLE "player"`);
        await queryRunner.query(`DROP TABLE "match"`);
        await queryRunner.query(`DROP TYPE "public"."match_status_enum"`);
        await queryRunner.query(`DROP TABLE "round"`);
        await queryRunner.query(`DROP TABLE "guess"`);
    }

}
