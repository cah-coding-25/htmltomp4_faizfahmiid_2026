package com.example.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface BuildDao {

    @Query("SELECT * FROM build_items ORDER BY createdAt DESC")
    fun getAllBuilds(): Flow<List<BuildItemEntity>>

    @Query("SELECT * FROM build_items WHERE id = :id LIMIT 1")
    fun getBuildByIdFlow(id: String): Flow<BuildItemEntity?>

    @Query("SELECT * FROM build_items WHERE id = :id LIMIT 1")
    suspend fun getBuildById(id: String): BuildItemEntity?

    @Query("SELECT * FROM build_items WHERE status IN ('QUEUED', 'RUNNING', 'BUILDING', 'PACKAGING')")
    suspend fun getActiveRunningBuilds(): List<BuildItemEntity>

    @Query("SELECT COUNT(*) FROM build_items WHERE createdAt >= :sinceTimestamp")
    suspend fun countBuildsSince(sinceTimestamp: Long): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBuild(build: BuildItemEntity)

    @Update
    suspend fun updateBuild(build: BuildItemEntity)

    @Query("UPDATE build_items SET status = :status, stage = :stage, completedAt = :completedAt WHERE id = :id")
    suspend fun updateBuildStatus(id: String, status: String, stage: String, completedAt: Long? = null)

    @Delete
    suspend fun deleteBuild(build: BuildItemEntity)

    @Query("DELETE FROM build_items WHERE id = :id")
    suspend fun deleteBuildById(id: String)

    @Query("DELETE FROM build_items")
    suspend fun clearAllBuilds()
}
