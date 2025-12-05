using UnityEngine;
using UnityEngine.SceneManagement;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance;
    
    [Header("Game Settings")]
    public int targetFrameRate = 144;
    public float timeScale = 1f;
    
    [Header("Player Stats")]
    public int playerHealth = 100;
    public int score = 0;
    public int enemiesKilled = 0;
    
    [Header("UI References")]
    public GameObject gameOverUI;
    public TMPro.TextMeshProUGUI scoreText;
    public TMPro.TextMeshProUGUI healthText;
    
    private bool gameActive = true;
    
    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }
    
    void Start()
    {
        Application.targetFrameRate = targetFrameRate;
        Time.timeScale = timeScale;
        UpdateUI();
    }
    
    public void AddScore(int points)
    {
        score += points;
        UpdateUI();
    }
    
    public void EnemyKilled()
    {
        enemiesKilled++;
        AddScore(100);
    }
    
    public void PlayerTakeDamage(int damage)
    {
        playerHealth -= damage;
        UpdateUI();
        
        if (playerHealth <= 0)
        {
            GameOver();
        }
    }
    
    void UpdateUI()
    {
        if (scoreText) scoreText.text = "Score: " + score;
        if (healthText) healthText.text = "Health: " + playerHealth;
    }
    
    void GameOver()
    {
        gameActive = false;
        Time.timeScale = 0f;
        if (gameOverUI) gameOverUI.SetActive(true);
        Cursor.lockState = CursorLockMode.None;
    }
    
    public void RestartGame()
    {
        Time.timeScale = 1f;
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }
}