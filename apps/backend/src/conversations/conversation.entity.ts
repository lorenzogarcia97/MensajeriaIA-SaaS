import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'contact_id' })
  contactId: string;

  @Column({ default: 'open' })
  status: string;

  @Column({ name: 'window_expires_at', type: 'timestamptz', nullable: true })
  windowExpiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
