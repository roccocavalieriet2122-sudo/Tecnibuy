from sqlalchemy import (
    Column,
    Integer,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    UniqueConstraint,
    Index,
)
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversation_users"),
        Index("idx_conversations_user_a", "user_a_id"),
        Index("idx_conversations_user_b", "user_b_id"),
        Index("idx_conversations_activity", "last_activity"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ciphertext = Column(LargeBinary, nullable=False)
    nonce = Column(LargeBinary(12), nullable=False)  # 96-bit for AES-GCM
    sender_pubkey_ref = Column(String(64), nullable=False)  # SHA-256 hex of sender public key
    meta_hash = Column(String(64), nullable=False)  # SHA-256 hex of metadata for tamper detection
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_messages_conversation", "conversation_id"),
        Index("idx_messages_sender", "sender_id"),
        Index("idx_messages_recipient", "recipient_id"),
        Index("idx_messages_created", "created_at"),
    )