using UnityEngine;
using UnityEngine.AI;

[RequireComponent(typeof(NavMeshAgent))]
public class AndroidEnemy : MonoBehaviour
{
    [Header("Android Stats")]
    public int health = 100;
    public int damage = 20;
    public float attackRange = 2f;
    public float detectionRange = 15f;
    public float attackCooldown = 1.5f;
    
    [Header("Movement")]
    public float patrolRadius = 10f;
    public float chaseSpeed = 6f;
    public float patrolSpeed = 3f;
    
    [Header("Android Effects")]
    public GameObject deathEffect;
    public AudioSource audioSource;
    public AudioClip attackSound;
    public AudioClip deathSound;
    public Material damagedMaterial;
    
    private NavMeshAgent agent;
    private Transform player;
    private Animator animator;
    private Renderer enemyRenderer;
    private Material originalMaterial;
    
    private float lastAttackTime;
    private Vector3 startPosition;
    private Vector3 patrolTarget;
    private bool isDead = false;
    
    public enum AndroidState { Patrol, Chase, Attack, Stunned }
    public AndroidState currentState = AndroidState.Patrol;
    
    void Start()
    {
        agent = GetComponent<NavMeshAgent>();
        animator = GetComponent<Animator>();
        enemyRenderer = GetComponent<Renderer>();
        
        if (enemyRenderer)
            originalMaterial = enemyRenderer.material;
        
        player = GameObject.FindGameObjectWithTag("Player")?.transform;
        startPosition = transform.position;
        
        SetNewPatrolTarget();
        agent.speed = patrolSpeed;
    }
    
    void Update()
    {
        if (isDead) return;
        
        float distanceToPlayer = Vector3.Distance(transform.position, player.position);
        
        switch (currentState)
        {
            case AndroidState.Patrol:
                Patrol();
                if (distanceToPlayer <= detectionRange)
                {
                    currentState = AndroidState.Chase;
                    agent.speed = chaseSpeed;
                }
                break;
                
            case AndroidState.Chase:
                ChasePlayer();
                if (distanceToPlayer <= attackRange)
                {
                    currentState = AndroidState.Attack;
                }
                else if (distanceToPlayer > detectionRange * 1.5f)
                {
                    currentState = AndroidState.Patrol;
                    agent.speed = patrolSpeed;
                }
                break;
                
            case AndroidState.Attack:
                AttackPlayer();
                if (distanceToPlayer > attackRange)
                {
                    currentState = AndroidState.Chase;
                }
                break;
        }
        
        // Update animator
        if (animator)
        {
            animator.SetFloat("Speed", agent.velocity.magnitude);
            animator.SetBool("IsAttacking", currentState == AndroidState.Attack);
        }
    }
    
    void Patrol()
    {
        if (!agent.pathPending && agent.remainingDistance < 0.5f)
        {
            SetNewPatrolTarget();
        }
    }
    
    void SetNewPatrolTarget()
    {
        Vector3 randomDirection = Random.insideUnitSphere * patrolRadius;
        randomDirection += startPosition;
        
        NavMeshHit hit;
        if (NavMesh.SamplePosition(randomDirection, out hit, patrolRadius, 1))
        {
            patrolTarget = hit.position;
            agent.SetDestination(patrolTarget);
        }
    }
    
    void ChasePlayer()
    {
        if (player)
        {
            agent.SetDestination(player.position);
        }
    }
    
    void AttackPlayer()
    {
        if (Time.time >= lastAttackTime + attackCooldown)
        {
            lastAttackTime = Time.time;
            
            // Face player
            Vector3 direction = (player.position - transform.position).normalized;
            transform.rotation = Quaternion.LookRotation(direction);
            
            // Attack
            if (audioSource && attackSound)
                audioSource.PlayOneShot(attackSound);
            
            // Deal damage to player
            PlayerController playerController = player.GetComponent<PlayerController>();
            if (playerController)
            {
                playerController.TakeDamage(damage);
            }
        }
    }
    
    public void TakeDamage(int damageAmount)
    {
        if (isDead) return;
        
        health -= damageAmount;
        
        // Visual feedback
        StartCoroutine(DamageFlash());
        
        // Switch to chase mode when damaged
        if (currentState == AndroidState.Patrol)
        {
            currentState = AndroidState.Chase;
            agent.speed = chaseSpeed;
        }
        
        if (health <= 0)
        {
            Die();
        }
    }
    
    System.Collections.IEnumerator DamageFlash()
    {
        if (enemyRenderer && damagedMaterial)
        {
            enemyRenderer.material = damagedMaterial;
            yield return new WaitForSeconds(0.1f);
            enemyRenderer.material = originalMaterial;
        }
    }
    
    void Die()
    {
        isDead = true;
        currentState = AndroidState.Stunned;
        
        if (audioSource && deathSound)
            audioSource.PlayOneShot(deathSound);
        
        if (deathEffect)
        {
            Instantiate(deathEffect, transform.position, transform.rotation);
        }
        
        // Notify game manager
        GameManager.Instance.EnemyKilled();
        
        // Disable components
        agent.enabled = false;
        GetComponent<Collider>().enabled = false;
        
        // Death animation or destroy
        if (animator)
        {
            animator.SetTrigger("Die");
            Destroy(gameObject, 3f);
        }
        else
        {
            Destroy(gameObject, 0.5f);
        }
    }
    
    void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(transform.position, attackRange);
        
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(transform.position, detectionRange);
        
        Gizmos.color = Color.blue;
        Gizmos.DrawWireSphere(startPosition, patrolRadius);
    }
}