using UnityEngine;

public class EnemySpawner : MonoBehaviour
{
    [Header("Spawning")]
    public GameObject androidEnemyPrefab;
    public Transform[] spawnPoints;
    public float spawnInterval = 5f;
    public int maxEnemies = 10;
    public float spawnRadius = 20f;
    
    [Header("Difficulty Scaling")]
    public float difficultyIncreaseRate = 0.1f;
    public float minSpawnInterval = 1f;
    
    private float nextSpawnTime;
    private int currentEnemyCount;
    private Transform player;
    
    void Start()
    {
        player = GameObject.FindGameObjectWithTag("Player")?.transform;
        nextSpawnTime = Time.time + spawnInterval;
    }
    
    void Update()
    {
        // Count current enemies
        currentEnemyCount = FindObjectsOfType<AndroidEnemy>().Length;
        
        // Spawn new enemies if needed
        if (Time.time >= nextSpawnTime && currentEnemyCount < maxEnemies)
        {
            SpawnEnemy();
            
            // Increase difficulty over time
            spawnInterval = Mathf.Max(minSpawnInterval, spawnInterval - difficultyIncreaseRate);
            nextSpawnTime = Time.time + spawnInterval;
        }
    }
    
    void SpawnEnemy()
    {
        Vector3 spawnPosition = GetSpawnPosition();
        
        if (spawnPosition != Vector3.zero)
        {
            GameObject enemy = Instantiate(androidEnemyPrefab, spawnPosition, Quaternion.identity);
            
            // Ensure enemy has proper setup
            AndroidEnemy androidComponent = enemy.GetComponent<AndroidEnemy>();
            if (androidComponent == null)
            {
                enemy.AddComponent<AndroidEnemy>();
            }
        }
    }
    
    Vector3 GetSpawnPosition()
    {
        // Try spawn points first
        if (spawnPoints.Length > 0)
        {
            Transform spawnPoint = spawnPoints[Random.Range(0, spawnPoints.Length)];
            
            // Check if spawn point is far enough from player
            if (player && Vector3.Distance(spawnPoint.position, player.position) > 10f)
            {
                return spawnPoint.position;
            }
        }
        
        // Fallback to random position around player
        if (player)
        {
            for (int attempts = 0; attempts < 10; attempts++)
            {
                Vector3 randomDirection = Random.insideUnitSphere * spawnRadius;
                randomDirection.y = 0; // Keep on ground level
                Vector3 spawnPos = player.position + randomDirection;
                
                // Ensure minimum distance from player
                if (Vector3.Distance(spawnPos, player.position) > 10f)
                {
                    // Check if position is valid (not inside walls)
                    if (!Physics.CheckSphere(spawnPos, 1f))
                    {
                        return spawnPos;
                    }
                }
            }
        }
        
        return Vector3.zero; // Failed to find valid position
    }
    
    void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.green;
        if (spawnPoints != null)
        {
            foreach (Transform point in spawnPoints)
            {
                if (point)
                    Gizmos.DrawWireSphere(point.position, 1f);
            }
        }
        
        if (player)
        {
            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(player.position, spawnRadius);
        }
    }
}